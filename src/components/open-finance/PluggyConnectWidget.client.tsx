import "@tanstack/react-start/client-only";

import { PluggyConnect } from "react-pluggy-connect";

export function PluggyConnectWidget(props: Record<string, unknown>) {
  return <PluggyConnect {...props} />;
}