import NumberInput from "../inputs/bet-amount-input";
import type { Line } from "../model/line";
import type { Team } from "../model/team";
import type { User } from "../model/user";
import BetSummary from "./bet-summary";
import type { BetFormState } from "./use-bet-form-state";

type BetFormFieldsProps = {
  form: BetFormState;
  users: User[];
  teams: Team[];
  lines: Line[];
  maps: { id: string; name: string }[];
  onTeamPickerOpenChange: (isOpen: boolean) => void;
  onLinePickerOpenChange: (isOpen: boolean) => void;
};

/**
 * Shared layout for composing a bet — BetSummary plus odds + betAmount inputs.
 * The caller renders its own action (submit button, slide-to-confirm, etc.).
 */
export default function BetFormFields({
  form,
  users,
  teams,
  lines,
  maps,
  onTeamPickerOpenChange,
  onLinePickerOpenChange,
}: BetFormFieldsProps) {
  const userA = form.selectedUserIds[0]
    ? users.find((u) => u.id === form.selectedUserIds[0]) ?? null
    : null;
  const userB = form.selectedUserIds[1]
    ? users.find((u) => u.id === form.selectedUserIds[1]) ?? null
    : null;
  const teamA = form.selectedTeamIds[0]
    ? teams.find((t) => t.id === form.selectedTeamIds[0]) ?? null
    : null;
  const teamB = form.selectedTeamIds[1]
    ? teams.find((t) => t.id === form.selectedTeamIds[1]) ?? null
    : null;

  return (
    <>
      <BetSummary
        users={users}
        teams={teams}
        userA={userA}
        userB={userB}
        onUserAChange={form.handleUserAChange}
        onUserBChange={form.handleUserBChange}
        teamA={teamA}
        teamB={teamB}
        onTeamAChange={form.handleTeamAChange}
        onTeamBChange={form.handleTeamBChange}
        onTeamPickerOpenChange={onTeamPickerOpenChange}
        maps={maps}
        selectedMapId={form.selectedMapId}
        onMapChange={form.setSelectedMapId}
        lines={lines}
        selectedLineId={form.selectedLineId}
        onLineChange={form.setSelectedLineId}
        onLinePickerOpenChange={onLinePickerOpenChange}
        onOverUnderChange={form.setOverUnder}
        onHandicapChange={form.setHandicap}
        odds={form.odds}
        betAmount={form.betAmount}
        date={form.date}
        initialOverUnder={form.initialOverUnder}
        initialHandicap={form.initialHandicap}
      />

      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          onChange={form.setOdds}
          placeholder="odds..."
          defaultValue={form.odds}
          svgPath="M8.891 15.107 15.11 8.89m-5.183-.52h.01m3.089 7.254h.01M14.08 3.902a2.849 2.849 0 0 0 2.176.902 2.845 2.845 0 0 1 2.94 2.94 2.849 2.849 0 0 0 .901 2.176 2.847 2.847 0 0 1 0 4.16 2.848 2.848 0 0 0-.901 2.175 2.843 2.843 0 0 1-2.94 2.94 2.848 2.848 0 0 0-2.176.902 2.847 2.847 0 0 1-4.16 0 2.85 2.85 0 0 0-2.176-.902 2.845 2.845 0 0 1-2.94-2.94 2.848 2.848 0 0 0-.901-2.176 2.848 2.848 0 0 1 0-4.16 2.849 2.849 0 0 0 .901-2.176 2.845 2.845 0 0 1 2.941-2.94 2.849 2.849 0 0 0 2.176-.901 2.847 2.847 0 0 1 4.159 0Z"
        />
        <NumberInput
          onChange={form.setBetAmount}
          placeholder="bet amount..."
          defaultValue={form.betAmount}
          svgPath="M8 17.345a4.76 4.76 0 0 0 2.558 1.618c2.274.589 4.512-.446 4.999-2.31.487-1.866-1.273-3.9-3.546-4.49-2.273-.59-4.034-2.623-3.547-4.488.486-1.865 2.724-2.899 4.998-2.31.982.236 1.87.793 2.538 1.592m-3.879 12.171V21m0-18v2.2"
        />
      </div>
    </>
  );
}
