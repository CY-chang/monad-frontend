import { useEffect, useState } from "react";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { OrderType } from "~~/store/tradeStore";

export type MergedOrderType = {
  price: bigint | undefined;
  totalAmount: bigint | undefined;
  orders: OrderType[];
};

export type OrderBookData = readonly [
  readonly {
    orderId: bigint;
    owner: string;
    price: bigint;
    amount: bigint;
    isBid: boolean;
  }[],
  readonly {
    orderId: bigint;
    owner: string;
    price: bigint;
    amount: bigint;
    isBid: boolean;
  }[],
];

export const useOrderBook = () => {
  const [mergedAsks, setMergedAsks] = useState<MergedOrderType[]>([]);
  const [mergedBids, setMergedBids] = useState<MergedOrderType[]>([]);

  // 使用新添加的getOrderBook函数获取完整订单簿
  const {
    data: orderBookData,
    refetch: refetchOrderBook,
    isLoading,
  } = useScaffoldReadContract({
    contractName: "CLOB",
    functionName: "getOrderBook",
  });

  // 处理订单簿数据
  useEffect(() => {
    if (orderBookData) {
      try {
        const { sortedMergedAsks, sortedMergedBids } = handleOrderBookData(orderBookData);
        setMergedAsks(sortedMergedAsks);
        setMergedBids(sortedMergedBids);
      } catch (error) {
        console.error("Error processing order book data:", error);
      }
    }
  }, [orderBookData]);

  return { mergedAsks, mergedBids, isLoading, refetchOrderBook };
};

function handleOrderBookData(orderBookData: OrderBookData): {
  sortedMergedAsks: MergedOrderType[];
  sortedMergedBids: MergedOrderType[];
} {
  const [bids, asks] = orderBookData;
  const processedBids: OrderType[] = bids.map(bid => ({
    orderId: Number(bid.orderId),
    owner: bid.owner,
    price: bid.price,
    amount: bid.amount,
    isBid: bid.isBid,
  }));

  // 转换卖单数据
  const processedAsks: OrderType[] = asks.map(ask => ({
    orderId: Number(ask.orderId),
    owner: ask.owner,
    price: ask.price,
    amount: ask.amount,
    isBid: ask.isBid,
  }));

  const mergedAskMap = new Map<string, MergedOrderType>();

  processedAsks.forEach(order => {
    if (!order.price) return;

    const priceKey = order.price.toString();

    if (mergedAskMap.has(priceKey)) {
      const existing = mergedAskMap.get(priceKey)!;
      existing.totalAmount = (existing.totalAmount || BigInt(0)) + (order.amount || BigInt(0));
      existing.orders.push(order);
    } else {
      mergedAskMap.set(priceKey, {
        price: order.price,
        totalAmount: order.amount,
        orders: [order],
      });
    }
  });

  // 合并买单
  const mergedBidMap = new Map<string, MergedOrderType>();

  processedBids.forEach(order => {
    if (!order.price) return;

    const priceKey = order.price.toString();

    if (mergedBidMap.has(priceKey)) {
      const existing = mergedBidMap.get(priceKey)!;
      existing.totalAmount = (existing.totalAmount || BigInt(0)) + (order.amount || BigInt(0));
      existing.orders.push(order);
    } else {
      mergedBidMap.set(priceKey, {
        price: order.price,
        totalAmount: order.amount,
        orders: [order],
      });
    }
  });

  // 转换为数组并排序
  const sortedMergedAsks = Array.from(mergedAskMap.values()).sort((a, b) => {
    if (!a.price || !b.price) return 0;
    return a.price > b.price ? 1 : -1;
  });

  const sortedMergedBids = Array.from(mergedBidMap.values()).sort((a, b) => {
    if (!a.price || !b.price) return 0;
    return a.price < b.price ? 1 : -1;
  });

  return { sortedMergedAsks, sortedMergedBids };
}
