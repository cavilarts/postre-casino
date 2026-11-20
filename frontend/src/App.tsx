import { createSignal, onSettled, Show } from "solid-js";
import { Lobby } from "./pages/Lobby";
import { TablePage } from "./pages/TablePage";

const TABLE_PATH = /^\/table\/([A-Za-z0-9]{4,8})\/?$/;

export function App() {
  const [path, setPath] = createSignal(location.pathname);

  const go = (to: string) => {
    history.pushState(null, "", to);
    setPath(to);
  };

  onSettled(() => {
    const onPop = () => setPath(location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  const tableCode = () => path().match(TABLE_PATH)?.[1] ?? null;

  return (
    <Show when={tableCode()} keyed fallback={<Lobby navigate={go} />}>
      {code => <TablePage code={code} navigate={go} />}
    </Show>
  );
}
