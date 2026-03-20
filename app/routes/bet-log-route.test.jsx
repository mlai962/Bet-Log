import { createRoutesStub } from "react-router";
import BetLogRoute from "./bet-log-route";
import { render, screen } from "@testing-library/react";

describe("BetLogRoute Tests", () => {
  it("should render the bet log with the correct title", async () => {
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: BetLogRoute,
        loader() {
          return {
            users: [],
            teams: [],
            lines: [],
          };
        },
        HydrateFallback: () => <div>Loading...</div>,
      },
    ]);

    render(<Stub initialEntries={["/"]} />);

    expect(
      await screen.findByText("gamba kappachungus deluxe"),
    ).toBeInTheDocument();
  });
});
