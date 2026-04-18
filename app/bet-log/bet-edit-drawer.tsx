import { useState } from "react";
import VerticalDrawer from "../common-components/vertical-drawer";
import SlideToConfirm from "../common-components/slide-to-confirm";
import Spinner from "../common-components/spinner";
import type { Bet, BetDto } from "../model/bet";
import type { Line } from "../model/line";
import type { Team } from "../model/team";
import type { User } from "../model/user";
import BetFormFields from "./bet-form-fields";
import { useBetFormState } from "./use-bet-form-state";

type BetEditDrawerProps = {
  bet: Bet | null;
  users: User[];
  teams: Team[];
  lines: Line[];
  maps: { id: string; name: string }[];
  onClose: () => void;
  onSave: (betId: string, data: Partial<BetDto>) => Promise<void>;
};

export default function BetEditDrawer({
  bet,
  users,
  teams,
  lines,
  maps,
  onClose,
  onSave,
}: BetEditDrawerProps) {
  return (
    <VerticalDrawer isOpen={bet !== null} onClose={onClose} direction="top">
      {bet && (
        <BetEditDrawerBody
          key={bet.id}
          bet={bet}
          users={users}
          teams={teams}
          lines={lines}
          maps={maps}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </VerticalDrawer>
  );
}

function BetEditDrawerBody({
  bet,
  users,
  teams,
  lines,
  maps,
  onClose,
  onSave,
}: {
  bet: Bet;
  users: User[];
  teams: Team[];
  lines: Line[];
  maps: { id: string; name: string }[];
  onClose: () => void;
  onSave: (betId: string, data: Partial<BetDto>) => Promise<void>;
}) {
  const form = useBetFormState({ initialBet: bet, maps });
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    const data = form.buildWriteData(lines);
    if (!data) return;

    setIsSaving(true);
    try {
      await onSave(bet.id, data);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 text-purple-200">
      <div className="text-xl font-bold text-center">Edit Bet</div>

      <div className="space-y-2">
        <BetFormFields
          form={form}
          users={users}
          teams={teams}
          lines={lines}
          maps={maps}
          onTeamPickerOpenChange={() => {}}
          onLinePickerOpenChange={() => {}}
        />

        <div
          className="h-[82px] p-2 rounded-lg border-1 text-purple-200 overflow-hidden
            bg-gray-400 dark:bg-purple-950/10
            border-purple-500 dark:border-purple-700"
        >
          <input
            type="date"
            value={form.date}
            onChange={(e) => form.setDate(e.target.value)}
            className="w-full min-w-0 h-full focus:outline-none"
          />
        </div>
      </div>

      <div className="relative">
        <div className={isSaving ? "opacity-20 pointer-events-none" : ""}>
          <SlideToConfirm
            label="slide to save"
            variant="purple"
            onConfirm={handleConfirm}
          />
        </div>
        <Spinner isShowSpinner={isSaving} />
      </div>
    </div>
  );
}
