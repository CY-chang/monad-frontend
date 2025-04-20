import { useState } from "react";
import { useScaffoldWatchContractEvent } from "~~/hooks/scaffold-eth";

// 定义交易记录的类型接口
interface TradeRecord {
  orderId1: number;
  orderId2: number;
  price: bigint | undefined;
  amount: bigint | undefined;
  timestamp: number;
  id: string;
}

export const useTradeHistory = () => {
  // TODO: 订单交易历史逻辑
};
