"use client";

import { useState } from "react";
import { useAtom } from "jotai";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { ApproveButton } from "~~/components/trade/ApproveButton";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { tradeTypeAtom } from "~~/store/tradeStore";

export const TradeForm = () => {
  const { address: connectedAddress } = useAccount();
  const [tradeType, setTradeType] = useAtom(tradeTypeAtom);

  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // CLOB合约下单
  const { writeContractAsync: placeClobOrder, isPending: isPlacingOrder } = useScaffoldWriteContract({
    contractName: "CLOB",
  });

  // 提交订单
  const handleSubmitOrder = async () => {
    if (!price || !amount || !connectedAddress) return;

    try {
      setSubmitting(true);

      // 下单
      await placeClobOrder({
        functionName: "placeOrder",
        args: [parseEther(price), parseEther(amount), tradeType === "buy" ? true : false],
      });

      // 重置表单
      setAmount("");
      setPrice("");
    } catch (error) {
      console.error("Order submission error:", error);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="space-y-4">
      {/* 买卖选择器 */}
      <div className="flex w-full">
        <button
          className={`flex-1 px-4 py-2 rounded-l-lg border transition-all duration-300 ease-in-out ${
            tradeType === "buy" ? "bg-[#2EBD85] text-white" : "bg-base-100 hover:bg-base-200 border-base-300"
          }`}
          onClick={() => setTradeType("buy")}
        >
          买入
        </button>
        <button
          className={`flex-1 px-4 py-2 rounded-r-lg border border-l-0 transition-all duration-300 ease-in-out ${
            tradeType === "sell" ? "bg-[#F6465D] text-white" : "bg-base-100 hover:bg-base-200 border-base-300"
          }`}
          onClick={() => setTradeType("sell")}
        >
          卖出
        </button>
      </div>

      {/* 价格输入 */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">价格</span>
        </label>
        <input
          type="number"
          placeholder="输入价格"
          className="input input-bordered w-full"
          value={price}
          onChange={e => setPrice(e.target.value)}
          min="0"
          step="0.000001"
        />
      </div>

      {/* 数量输入 */}
      <div className="form-control">
        <label className="label">
          <span className="label-text">数量(支付数量)</span>
        </label>
        <input
          type="number"
          placeholder="输入数量"
          className="input input-bordered w-full"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          min="0"
          step="0.000001"
        />
      </div>

      {/* 提交按钮 - 使用ApproveButton组件 */}
      <div className="mt-4">
        <ApproveButton
          tokenName={tradeType === "buy" ? "BTC" : "USDC"}
          amount={amount}
          className="btn btn-primary w-full"
          approveText={`授权 ${tradeType === "buy" ? "BTC" : "USDC"}`}
        >
          <button
            className={`btn w-full ${tradeType === "buy" ? "btn-success" : "btn-error"}`}
            onClick={handleSubmitOrder}
            disabled={!connectedAddress || !price || !amount || isPlacingOrder || submitting}
          >
            {submitting ? "提交中..." : tradeType === "buy" ? "买入" : "卖出"}
          </button>
        </ApproveButton>
      </div>
    </div>
  );
};
