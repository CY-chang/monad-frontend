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
  // TODO: 实现订单簿数据获取逻辑
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
