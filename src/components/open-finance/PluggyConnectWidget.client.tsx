import "@tanstack/react-start/client-only";

import { PluggyConnect, type PluggyConnectProps } from "react-pluggy-connect";

export function PluggyConnectWidget(props: PluggyConnectProps) {
  return <PluggyConnect {...props} />;
}