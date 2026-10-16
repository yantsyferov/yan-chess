import { Chess } from "chess.js";
import { Board } from "../components/game/Board";
import { FriendsLobbyPanel } from "../features/play/FriendsLobbyPanel";

const START_FEN = new Chess().fen();

export function PlayFriend(): JSX.Element {
  return (
    <div className="flex md:flex-row flex-col gap-6 max-w-6xl mx-auto px-4 py-8">
      <div className="md:w-[400px] shrink-0">
        <Board
          fen={START_FEN}
          canInteract={false}
          boardOrientation="white"
          lastMove={null}
          pendingPromotion={null}
          selectedSquare={null}
          onMove={() => {}}
          onSelectSquare={() => {}}
        />
      </div>
      <div className="flex-1">
        <FriendsLobbyPanel />
      </div>
    </div>
  );
}
