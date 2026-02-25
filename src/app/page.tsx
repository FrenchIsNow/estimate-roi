import ScenarioExplorer from "@/components/ScenarioExplorer";
import Gatekeeper from "@/components/Gatekeeper";

export default function Home() {
  return (
    <main>
      <Gatekeeper>
        <ScenarioExplorer />
      </Gatekeeper>
    </main>
  );
}
