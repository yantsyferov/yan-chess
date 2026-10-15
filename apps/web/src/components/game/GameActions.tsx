import { Button } from "../ui/Button";

interface GameActionsProps {
  canAct: boolean;
  onResignClick: () => void;
  onOfferDraw: () => void;
  /** Default true. Pass false to hide the draw-offer button (e.g. vs bot — nobody to accept). */
  showDrawOffer?: boolean;
}

export function GameActions({
  canAct,
  onResignClick,
  onOfferDraw,
  showDrawOffer = true,
}: GameActionsProps): JSX.Element | null {
  if (!canAct) return null;
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={onResignClick}>Resign</Button>
      {showDrawOffer && (
        <Button variant="secondary" onClick={onOfferDraw}>Offer draw</Button>
      )}
    </div>
  );
}
