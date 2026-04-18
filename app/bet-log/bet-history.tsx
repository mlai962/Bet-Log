import { useState } from "react";
import {
  Bet,
  EXTRA_BINARY_LINE_OPTION,
  EXTRA_BINARY_LINE_VALUE,
  getBetOutcome,
} from "../model/bet";
import { LineType } from "../model/line";
import Spinner from "../common-components/spinner";
import Drawer from "../common-components/drawer";
import SlideToConfirm from "../common-components/slide-to-confirm";
import { useToast } from "../common-components/toast";

type BetHistoryProps = {
  bets: Bet[];
  handleBetSettlement: (betId: string, winner: string) => void;
  handleBetDeletion: (betId: string) => void;
  isShowBetSettlementSpinner: boolean;
  currentBetIdBeingSettled: string;
  onDeleteDrawerOpenChange?: (isOpen: boolean) => void;
  onSettleDrawerOpenChange?: (isOpen: boolean) => void;
  onEditRequest?: (betId: string) => void;
};

export default function BetHistory({
  bets,
  handleBetSettlement,
  handleBetDeletion,
  isShowBetSettlementSpinner,
  currentBetIdBeingSettled,
  onDeleteDrawerOpenChange,
  onSettleDrawerOpenChange,
  onEditRequest,
}: BetHistoryProps) {
  const { showToast } = useToast();

  const handleEditClick = (bet: Bet) => {
    if (bet.winner !== "") {
      showToast("unsettle this bet before editing");
      return;
    }
    onEditRequest?.(bet.id);
  };
  const [deletingBetId, setDeletingBetId] = useState<string | null>(null);
  const [settlingBetId, setSettlingBetId] = useState<string | null>(null);

  const openDeleteDrawer = (betId: string) => {
    setDeletingBetId(betId);
    onDeleteDrawerOpenChange?.(true);
  };

  const closeDeleteDrawer = () => {
    setDeletingBetId(null);
    onDeleteDrawerOpenChange?.(false);
  };

  const openSettleDrawer = (betId: string) => {
    setSettlingBetId(betId);
    onSettleDrawerOpenChange?.(true);
  };

  const closeSettleDrawer = () => {
    setSettlingBetId(null);
    onSettleDrawerOpenChange?.(false);
  };

  const settlingBet = settlingBetId
    ? bets.find((b) => b.id === settlingBetId) ?? null
    : null;

  return (
    <>
      <Drawer
        isOpen={deletingBetId !== null}
        onClose={closeDeleteDrawer}
        direction="top"
      >
        <div className="space-y-4 text-purple-200">
          <div className="text-xl font-bold text-center">Delete Bet?</div>
          <SlideToConfirm
            label="slide to delete"
            onConfirm={() => {
              handleBetDeletion(deletingBetId!);
              closeDeleteDrawer();
            }}
          />
        </div>
      </Drawer>
      <Drawer
        isOpen={settlingBetId !== null}
        onClose={closeSettleDrawer}
        direction="top"
      >
        <div className="space-y-4 text-purple-200">
          <div className="text-xl font-bold text-center">Settle Bet</div>
          {settlingBet && (
            <div className="space-y-3">
              <SlideToConfirm
                label={`${settlingBet.userA.name} wins`}
                variant="purple"
                onConfirm={() => {
                  handleBetSettlement(settlingBet.id, "userA");
                  closeSettleDrawer();
                }}
              />
              <SlideToConfirm
                label={`${settlingBet.userB.name} wins`}
                variant="purple"
                onConfirm={() => {
                  handleBetSettlement(settlingBet.id, "userB");
                  closeSettleDrawer();
                }}
              />
              <SlideToConfirm
                label="clear winner"
                variant="purple"
                onConfirm={() => {
                  handleBetSettlement(settlingBet.id, "");
                  closeSettleDrawer();
                }}
              />
            </div>
          )}
        </div>
      </Drawer>
      <div className="w-full h-max flex justify-center">
        <div className="w-max space-y-1 flex flex-col">
          {bets.map((bet) => {
            const binaryLineOption: boolean =
              bet.extras[EXTRA_BINARY_LINE_OPTION] ?? true;
            const binaryLineValue: number =
              bet.extras[EXTRA_BINARY_LINE_VALUE] ?? 0;
            const outcome = getBetOutcome(bet);

            return (
              <div
                key={bet.id}
                className="rounded-lg p-2 border-1 relative
              text-purple-200
              bg-gray-400 dark:bg-purple-950/10
              border-purple-500 dark:border-purple-700"
              >
                <div
                  className={`w-full h-max flex flex-col items-center ${
                    isShowBetSettlementSpinner &&
                    currentBetIdBeingSettled == bet.id
                      ? "opacity-20"
                      : ""
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex gap-2 text-left text-sm">
                      <div>
                        {bet.date
                          .toDate()
                          .toLocaleDateString("en-US", { weekday: "long" })}
                      </div>
                      <div>{bet.date.toDate().toLocaleDateString()}</div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <svg
                        className="w-4 h-4 text-gray-800 dark:text-white
                        hover:text-purple-400/75 cursor-pointer"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="none"
                        viewBox="0 0 24 24"
                        onClick={() => openSettleDrawer(bet.id)}
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M21 13v-2a1 1 0 0 0-1-1h-.757l-.707-1.707.535-.536a1 1 0 0 0 0-1.414l-1.414-1.414a1 1 0 0 0-1.414 0l-.536.535L14 4.757V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v.757l-1.707.707-.536-.535a1 1 0 0 0-1.414 0L4.929 6.343a1 1 0 0 0 0 1.414l.536.536L4.757 10H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h.757l.707 1.707-.535.536a1 1 0 0 0 0 1.414l1.414 1.414a1 1 0 0 0 1.414 0l.536-.535 1.707.707V20a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.757l1.707-.708.536.536a1 1 0 0 0 1.414 0l1.414-1.414a1 1 0 0 0 0-1.414l-.535-.536.707-1.707H20a1 1 0 0 0 1-1Z"
                        />
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                        />
                      </svg>

                      <svg
                        className="w-4 h-4 text-gray-800 dark:text-white
                        hover:text-purple-400/75 cursor-pointer"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="none"
                        viewBox="0 0 24 24"
                        onClick={() => handleEditClick(bet)}
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M10.779 17.779 4.36 19.918 6.5 13.5m4.279 4.279 8.364-8.643a3.027 3.027 0 0 0-2.14-5.165 3.03 3.03 0 0 0-2.14.886L6.5 13.5m4.279 4.279L6.499 13.5m2.14 2.14 6.213-6.504M12.75 7.04 17 11.28"
                        />
                      </svg>

                      <svg
                        className="w-4 h-4 text-gray-800 dark:text-white 
                        hover:text-red-500/75 cursor-pointer"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="none"
                        viewBox="0 0 24 24"
                        onClick={() => openDeleteDrawer(bet.id)}
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="flex flex-wrap w-full text-sm">
                    {bet.map}{" "}
                    {bet.line.lineType === LineType.HANDICAP
                      ? (binaryLineOption ? "+" : "-") + binaryLineValue + " "
                      : ""}
                    {bet.line.name}{" "}
                    {bet.line.lineType === LineType.OVER_UNDER
                      ? (binaryLineOption ? "o" : "u") + binaryLineValue
                      : ""}
                  </div>

                  <div className="w-full flex text-lg">
                    <div
                      className={`flex-wrap w-1/2 text-left
                      ${
                        bet.winner === "userA"
                          ? "text-purple-600 font-extrabold"
                          : ""
                      } ${bet.winner === "userB" ? "text-purple-200/40" : ""}`}
                    >
                      {bet.teamA.name} @{bet.odds.toFixed(2)} ${bet.betAmount}
                    </div>
                    <div
                      className={`flex-wrap w-1/2 text-right
                      ${
                        bet.winner === "userB"
                          ? "text-purple-600 font-extrabold"
                          : ""
                      } ${bet.winner === "userA" ? "text-purple-200/40" : ""}`}
                    >
                      {bet.teamB.name}
                    </div>
                  </div>

                  <div className="w-full flex text-sm">
                    <div
                      className={`w-1/2 text-left
                      ${
                        bet.winner === "userA"
                          ? "text-purple-600 font-extrabold"
                          : ""
                      } ${bet.winner === "userB" ? "text-purple-200/40" : ""}`}
                    >
                      {bet.userA.name}
                    </div>
                    <div
                      className={`w-1/2 text-right
                      ${
                        bet.winner === "userB"
                          ? "text-purple-600 font-extrabold"
                          : ""
                      } ${bet.winner === "userA" ? "text-purple-200/40" : ""}`}
                    >
                      {bet.userB.name}
                    </div>
                  </div>

                  {outcome ? (
                    <div className="flex w-full justify-between">
                      {bet.winner === "userA" ? (
                        <div className="text-purple-600 font-extrabold">
                          +${outcome.userA}
                        </div>
                      ) : (
                        <div className="text-purple-200/40">
                          -${Math.abs(outcome.userA)}
                        </div>
                      )}
                      {bet.winner === "userB" ? (
                        <div className="text-purple-600 font-extrabold">
                          +${outcome.userB}
                        </div>
                      ) : (
                        <div className="text-purple-200/40">
                          -${Math.abs(outcome.userB)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <></>
                  )}
                </div>

                <Spinner
                  isShowSpinner={
                    isShowBetSettlementSpinner &&
                    currentBetIdBeingSettled == bet.id
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
