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
  const [orderMatchedEvents, setOrderMatchedEvents] = useState<TradeRecord[]>([]);

  useScaffoldWatchContractEvent({
    contractName: "CLOB",
    eventName: "OrderMatched",
    onLogs: logs => {
      logs.forEach(log => {
        setOrderMatchedEvents(prevLogs => [
          {
            orderId1: Number(log.args.orderId1),
            orderId2: Number(log.args.orderId2),
            price: log.args.price,
            amount: log.args.amount,
            timestamp: Number(log.blockNumber || Date.now() / 1000),
            id: `${log.transactionHash}-${log.logIndex}`,
          },
          ...prevLogs,
        ]);
      });
    },
  });

  return { orderMatchedEvents };
};
