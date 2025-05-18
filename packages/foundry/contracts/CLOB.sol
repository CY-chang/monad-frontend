// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

error InvalidPriceOrAmount();//0x88f12bba
error TransferFailed(); //0x90b8ec18
error NotOrderOwner(); //0xf6412b5a
error OrderNotFoundOrCancelled();//0x01a5bd33
error TransferToSellerFailed();//0x35d2079c
error TransferToBuyerFailed();//0xb24b704a

contract CLOB {
    // 订单结构
    struct Order {
        address owner; // 订单所有者
        uint256 price; // 订单价格
        uint256 amount; // 订单数量
        uint128 next; // 下一个订单的ID
        bool isBid; // 是否为买单
    }

    // 订单簿
    mapping(uint128 => Order) public orders;
    uint128 public orderCount;

    // 买单和卖单的头指针（使用 uint128 存储）
    uint128 public bidHead;
    uint128 public askHead;

    // 代币合约
    IERC20 public immutable token0;
    IERC20 public immutable token1;

    // 事件
    event OrderPlaced(uint128 orderId, address owner, uint256 price, uint256 amount, bool isBid);
    event OrderMatched(uint128 orderId1, uint128 orderId2, uint256 price, uint256 amount);
    event OrderCancelled(uint128 orderId);

    constructor(address _token0, address _token1) {
        // 确保 token0 的地址小于 token1
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    function placeOrder(uint256 price, uint256 amount, bool isBid) external {
        if (!(price > 0 && amount > 0)) revert InvalidPriceOrAmount();

        // 确定需要转移的代币（买单使用token0，卖单使用token1）
        IERC20 tokenToLock = isBid ? token0 : token1;
        if (!tokenToLock.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        _placeOrder(price, amount, isBid);
    }

    function _placeOrder(uint256 price, uint256 amount, bool isBid) internal {
        uint256 remainingAmount = amount;

        // 尝试撮合现有订单
        remainingAmount = _matchOrders(price, remainingAmount, isBid);

        // 如果还有剩余数量，创建新订单
        if (remainingAmount > 0) {
            _createOrder(price, remainingAmount, isBid);
        }
    }

    // 通用撮合函数，处理买单和卖单
    function _matchOrders(uint256 price, uint256 amount, bool isBid) internal returns (uint256) {
        // 基于订单类型确定要匹配的链表头
        // 买单匹配卖单链表，卖单匹配买单链表
        uint128 currentOrderId = isBid ? askHead : bidHead;
        uint128 prevOrderId = 0;
        uint256 remainingAmount = amount;

        // 链表按价格排序: ask从低到高，bid从高到低
        while (currentOrderId != 0 && remainingAmount > 0) {
            Order storage matchOrder = orders[currentOrderId];

            // 检查价格匹配 - 利用链表的排序特性
            if (isBid) {
                // 买单匹配卖单：如果卖单价格高于买入价，停止匹配
                if (matchOrder.price > price) break;
            } else {
                // 卖单匹配买单：如果买单价格低于卖出价，停止匹配
                if (matchOrder.price < price) break;
            }

            // 计算可撮合数量
            uint256 matchAmountInOriginalUnit;
            if (isBid) {
                // 买单情况：计算能买到的token1数量
                // 买家给出的token0能买到多少token1
                uint256 buyableToken1 = (remainingAmount * 1e18) / matchOrder.price;
                // 匹配数量是实际可买到的token1与卖单提供的token1中的较小值
                matchAmountInOriginalUnit = _min(buyableToken1, matchOrder.amount);
            } else {
                // 卖单情况：计算能卖出的token1数量
                matchAmountInOriginalUnit = _min(remainingAmount, matchOrder.amount);
            }

            // 执行撮合
            if (isBid) {
                // 当前用户是买家（使用token0买token1），匹配的订单所有者是卖家
                _executeMatch(msg.sender, matchOrder.owner, matchAmountInOriginalUnit, matchOrder.price);
            } else {
                // 当前用户是卖家（使用token1卖token0），匹配的订单所有者是买家
                _executeMatch(matchOrder.owner, msg.sender, matchAmountInOriginalUnit, matchOrder.price);
            }

            // 更新剩余数量
            if (isBid) {
                // 买单情况：更新剩余的token0数量
                uint256 usedToken0 = (matchAmountInOriginalUnit * matchOrder.price) / 1e18;
                remainingAmount -= usedToken0;
            } else {
                // 卖单情况：更新剩余的token1数量
                remainingAmount -= matchAmountInOriginalUnit;
            }
            matchOrder.amount -= matchAmountInOriginalUnit;

            uint128 nextOrderId = matchOrder.next;

            // 如果订单完全成交，从链表中移除
            if (matchOrder.amount == 0) {
                _removeOrder(currentOrderId, prevOrderId, !isBid);
                // 移动到下一个订单
                currentOrderId = prevOrderId == 0 ? (isBid ? askHead : bidHead) : orders[prevOrderId].next;
            } else {
                // 移动到下一个订单
                prevOrderId = currentOrderId;
                currentOrderId = nextOrderId;
            }
        }

        return remainingAmount;
    }

    // 辅助函数：找出两个数中较小的一个
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // 执行撮合交易
    function _executeMatch(address buyer, address seller, uint256 amount, uint256 price) internal {
        // 计算交易金额
        uint256 tokenAmount = amount;
        uint256 paymentAmount = (amount * price) / 1e18; // 假设价格精度为 18 位

        // 买家已经在placeOrder中锁定了token0，卖家已经锁定了token1
        // 将token1转给买家，将token0转给卖家
        if (!token1.transfer(buyer, tokenAmount)) revert TransferToBuyerFailed();
        if (!token0.transfer(seller, paymentAmount)) revert TransferToSellerFailed();

        emit OrderMatched(0, 0, price, amount);
    }

    // 创建新订单
    function _createOrder(uint256 price, uint256 amount, bool isBid) internal {
        uint128 orderId = ++orderCount;
        orders[orderId] = Order({ owner: msg.sender, price: price, amount: amount, next: 0, isBid: isBid });

        // 插入订单到链表
        _insertOrder(orderId, isBid);

        emit OrderPlaced(orderId, msg.sender, price, amount, isBid);
    }

    // 从链表中移除订单
    function _removeOrder(uint128 orderId, uint128 prevId, bool isBid) internal {
        if (prevId == 0) {
            if (isBid) {
                bidHead = orders[orderId].next;
            } else {
                askHead = orders[orderId].next;
            }
        } else {
            orders[prevId].next = orders[orderId].next;
        }
    }

        // 取消订单
    function cancelOrder(uint128 orderId) external {
        if (orders[orderId].owner != msg.sender) revert NotOrderOwner();

        // 查找订单所在的链表
        bool isBid = orders[orderId].isBid;
        uint128 current = isBid ? bidHead : askHead;
        uint128 prev = 0;

        while (current != 0 && current != orderId) {
            prev = current;
            current = orders[current].next;
        }

        // 确保订单在链表中
        if (current != orderId) revert OrderNotFoundOrCancelled();

        // 从链表中移除订单
        _removeOrder(orderId, prev, isBid);

        // 返还资金
        IERC20 tokenToReturn = isBid ? token0 : token1;
        if (!tokenToReturn.transfer(msg.sender, orders[orderId].amount)) revert TransferFailed();

        emit OrderCancelled(orderId);
    }

    // 内部函数：插入订单到链表
    function _insertOrder(uint128 orderId, bool isBid) internal {
        uint128 current = isBid ? bidHead : askHead;
        uint128 prev = 0;

        // 找到合适的位置插入
        while (current != 0) {
            if (isBid) {
                if (orders[current].price < orders[orderId].price) break;
            } else {
                if (orders[current].price > orders[orderId].price) break;
            }
            prev = current;
            current = orders[current].next;
        }

        // 插入订单
        if (prev == 0) {
            if (isBid) {
                bidHead = orderId;
            } else {
                askHead = orderId;
            }
        } else {
            orders[prev].next = orderId;
        }
        orders[orderId].next = current;
    }

     // 获取最佳买卖价格
    function getBestBid() public view returns (uint256) {
        return bidHead != 0 ? orders[bidHead].price : 0;
    }

    function getBestAsk() public view returns (uint256) {
        return askHead != 0 ? orders[askHead].price : 0;
    }

    // 获取订单簿深度
    function getOrderBookDepth() public view returns (uint128 bidDepth, uint128 askDepth) {
        uint128 current = bidHead;
        while (current != 0) {
            bidDepth++;
            current = orders[current].next;
        }

        current = askHead;
        while (current != 0) {
            askDepth++;
            current = orders[current].next;
        }
    }

    // 获取完整订单簿
    struct OrderInfo {
        uint128 orderId;
        address owner;
        uint256 price;
        uint256 amount;
        bool isBid;
    }

    function getOrderBook() public view returns (OrderInfo[] memory bids, OrderInfo[] memory asks) {
        // 获取订单簿深度
        (uint128 bidDepth, uint128 askDepth) = getOrderBookDepth();
        
        // 创建结果数组
        bids = new OrderInfo[](bidDepth);
        asks = new OrderInfo[](askDepth);
        
        // 填充买单数组
        uint128 current = bidHead;
        uint128 index = 0;
        while (current != 0 && index < bidDepth) {
            Order storage order = orders[current];
            bids[index] = OrderInfo({
                orderId: current,
                owner: order.owner,
                price: order.price,
                amount: order.amount,
                isBid: true
            });
            current = order.next;
            index++;
        }
        
        // 填充卖单数组
        current = askHead;
        index = 0;
        while (current != 0 && index < askDepth) {
            Order storage order = orders[current];
            asks[index] = OrderInfo({
                orderId: current,
                owner: order.owner,
                price: order.price,
                amount: order.amount,
                isBid: false
            });
            current = order.next;
            index++;
        }
        
        return (bids, asks);
    }
}
