import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

export function PlayVsBotBlock(): JSX.Element {
  return (
    <Card variant="glass" padding="lg">
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-2xl font-semibold text-text-primary text-center">
          Play vs bot
        </h2>
        <Link to="/vs-bot">
          <Button variant="primary" size="lg">
            Play vs bot
          </Button>
        </Link>
      </div>
    </Card>
  );
}
