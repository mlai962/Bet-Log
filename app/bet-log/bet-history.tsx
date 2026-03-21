import { useState } from "react";
import {
  Bet,
  EXTRA_BINARY_LINE_OPTION,
  EXTRA_BINARY_LINE_VALUE,
} from "../model/bet";
import { LineType } from "../model/line";
import Spinner from "../common-components/spinner";
import BottomDrawer from "../common-components/bottom-drawer";
import SlideToConfirm from "../common-components/slide-to-confirm";

type BetHistoryProps = {
  bets: Bet[];
  handleBetSettlement: (betId: string, winner: string) => void;
  handleBetDeletion: (betId: string) => void;
  isShowBetSettlementSpinner: boolean;
  currentBetIdBeingSettled: string;
  onDeleteDrawerOpenChange?: (isOpen: boolean) => void;
};

export default function BetHistory({
  bets,
  handleBetSettlement,
  handleBetDeletion,
  isShowBetSettlementSpinner,
  currentBetIdBeingSettled,
  onDeleteDrawerOpenChange,
}: BetHistoryProps) {
  const [deletingBetId, setDeletingBetId] = useState<string | null>(null);

  const openDeleteDrawer = (betId: string) => {
    setDeletingBetId(betId);
    onDeleteDrawerOpenChange?.(true);
  };

  const closeDeleteDrawer = () => {
    setDeletingBetId(null);
    onDeleteDrawerOpenChange?.(false);
  };

  return (
    <>
      <BottomDrawer
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
      </BottomDrawer>
      <div className="w-full h-max flex justify-center">
        <div className="w-max space-y-1 flex flex-col">
          {bets.map((bet) => {
            const binaryLineOption: boolean =
              bet.extras[EXTRA_BINARY_LINE_OPTION] ?? true;
            const binaryLineValue: number =
              bet.extras[EXTRA_BINARY_LINE_VALUE] ?? 0;

            return (
              <div
                key={bet.id}
                className="rounded-lg py-2 px-4 border-1 relative
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
                  <div className="flex gap-2">
                    <div>
                      {bet.date
                        .toDate()
                        .toLocaleDateString("en-US", { weekday: "long" })}
                    </div>
                    <div>{bet.date.toDate().toLocaleDateString()}</div>
                  </div>

                  <div className="w-full flex">
                    <div className="w-[45%] flex justify-end items-center gap-2">
                      {bet.userA.name}
                      <input
                        id={"checkbox-userA-" + bet.id}
                        type="checkbox"
                        value="userA"
                        name={"checkbox-userA-" + bet.id}
                        checked={bet.winner === "userA"}
                        onChange={(e) => {
                          handleBetSettlement(
                            bet.id,
                            e.target.checked ? "userA" : "",
                          );
                        }}
                        className="w-4 h-4
                        accent-purple-800 dark:accent-purple-600
                        bg-gray-100 dark:bg-gray-700
                        border-gray-300 dark:border-gray-600
                        focus:ring-0 hover:cursor-pointer"
                      />
                    </div>
                    <div className="w-[10%] text-center">v</div>
                    <div className="w-[45%] flex justify-start items-center gap-2">
                      <input
                        id={"checkbox-userB-" + bet.id}
                        type="checkbox"
                        value="userB"
                        name={"checkbox-userB-" + bet.id}
                        checked={bet.winner === "userB"}
                        onChange={(e) => {
                          handleBetSettlement(
                            bet.id,
                            e.target.checked ? "userB" : "",
                          );
                        }}
                        className="w-4 h-4 ms-1
                        accent-purple-800 dark:accent-purple-600
                        bg-gray-100 dark:bg-gray-700
                        border-gray-300 dark:border-gray-600
                        focus:ring-0 hover:cursor-pointer"
                      />
                      {bet.userB.name}
                    </div>
                  </div>

                  <div className="w-full flex">
                    <div className="w-[45%] text-right">{bet.teamA.name}</div>
                    <div className="w-[10%] text-center">v</div>
                    <div className="w-[45%] text-left">{bet.teamB.name}</div>
                  </div>

                  <div className="flex flex-wrap gap-x-2 justify-center text-center">
                    <div>
                      {bet.map}{" "}
                      {bet.line.lineType === LineType.HANDICAP
                        ? (binaryLineOption ? "+" : "-") + binaryLineValue + " "
                        : ""}
                      {bet.line.name}{" "}
                      {bet.line.lineType === LineType.OVER_UNDER
                        ? (binaryLineOption ? "o" : "u") + binaryLineValue
                        : ""}
                    </div>
                    <div>
                      @{bet.odds.toFixed(2)} ${bet.betAmount}
                    </div>
                  </div>
                </div>

                <svg
                  className="w-6 h-6 text-gray-800 dark:text-white 
                hover:text-red-500/75 cursor-pointer absolute top-1 right-1"
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
