import { useState } from "react";
import { Handicap, OverUnder } from "../model/binary-option-and-number";

export enum BinaryOptionType {
  OVER_UNDER,
  HANDICAP,
}

type BinaryOptionAndNumberInputProps = {
  onChange: (binaryOption: OverUnder | Handicap) => void;
  type: BinaryOptionType;
  initialValue?: OverUnder | Handicap;
};

const readInitial = (initial?: OverUnder | Handicap) => {
  if (initial instanceof OverUnder) return { optionOne: initial.over, value: initial.value };
  if (initial instanceof Handicap) return { optionOne: initial.plus, value: initial.value };
  return { optionOne: true, value: 0.5 };
};

export default function BinaryOptionAndNumberInput({
  onChange,
  type,
  initialValue,
}: BinaryOptionAndNumberInputProps) {
  const initial = readInitial(initialValue);
  const [isOptionOneSelected, setIsOptionOneSelected] = useState(initial.optionOne);
  const [isOptionTwoSelected, setIsOptionTwoSelected] = useState(!initial.optionOne);

  const [value, setValue] = useState<number>(initial.value);

  const handleOptionChange = (isOptionOne: boolean) => {
    setIsOptionOneSelected(isOptionOne);
    setIsOptionTwoSelected(!isOptionOne);

    executeOnChange(isOptionOne, value);
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // e.target.value is a string, so parse it
    const parsed = parseFloat(e.target.value);
    // if the field is empty, parsed will be NaN
    const newValue = !isNaN(parsed) ? parsed : 0;
    setValue(newValue);

    executeOnChange(isOptionOneSelected, newValue);
  };

  const executeOnChange = (isOptionOne: boolean, value: number) => {
    if (type === BinaryOptionType.OVER_UNDER) {
      onChange(new OverUnder(isOptionOne, value));
    } else if (type === BinaryOptionType.HANDICAP) {
      onChange(new Handicap(isOptionOne, value));
    }
  };

  return (
    <div
      className="flex w-max rounded-lg gap-2 p-2 border-1 
        bg-gray-400 dark:bg-purple-950/10
        border-purple-500 dark:border-purple-700"
    >
      <button
        className={`w-16 h-16 rounded-lg border-1
          border-purple-500 dark:border-purple-700
          hover:bg-purple-200 dark:hover:bg-purple-600
          active:bg-purple-300 dark:active:bg-purple-500
          hover:cursor-pointer hover:disabled:cursor-not-allowed
            ${
              isOptionOneSelected
                ? "bg-purple-300 dark:bg-purple-500/75"
                : "bg-gray-400 dark:bg-purple-700/50"
            }
        `}
        onClick={() => {
          handleOptionChange(true);
        }}
      >
        <p
          className={`text-base ${
            isOptionOneSelected ? "font-extrabold" : "font-normal"
          }`}
        >
          {type === BinaryOptionType.OVER_UNDER ? "O" : "+"}
        </p>
      </button>
      <button
        className={`w-16 h-16 rounded-lg border-1
          border-purple-500 dark:border-purple-700
          hover:bg-purple-200 dark:hover:bg-purple-600
          active:bg-purple-300 dark:active:bg-purple-500
          hover:cursor-pointer hover:disabled:cursor-not-allowed
            ${
              isOptionTwoSelected
                ? "bg-purple-300 dark:bg-purple-500/75"
                : "bg-gray-400 dark:bg-purple-700/50"
            }
        `}
        onClick={() => {
          handleOptionChange(false);
        }}
      >
        <p
          className={`text-base ${
            isOptionTwoSelected ? "font-extrabold" : "font-normal"
          }`}
        >
          {type === BinaryOptionType.OVER_UNDER ? "U" : "-"}
        </p>
      </button>
      <input
        className={`w-24 h-16 rounded-lg border-1 p-2
          border-purple-500 dark:border-purple-700
          hover:disabled:cursor-not-allowed
          focus:outline-none caret-purple-400
        `}
        type="number"
        step="0.5"
        min="0.5"
        defaultValue={initial.value}
        onChange={handleValueChange}
      />
    </div>
  );
}
