import { Button, Card, Text, Title3 } from "@fluentui/react-components";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

function errorDetail(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return error.status + " " + error.statusText;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected route error occurred.";
}

export function RouteErrorPage() {
  const error = useRouteError();

  return (
    <main className="routeErrorPage" role="alert">
      <Card className="errorCard">
        <Title3>ReactOracle could not render this page</Title3>
        <Text className="muted">{errorDetail(error)}</Text>
        <div className="quickActions">
          <Button appearance="primary" onClick={() => window.location.reload()}>Reload</Button>
          <Button onClick={() => window.location.assign("/")}>Return to Overview</Button>
        </div>
      </Card>
    </main>
  );
}
