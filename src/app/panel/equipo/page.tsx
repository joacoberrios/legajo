import TeamPage from "@/app/taller/equipo/page";

export default async function PanelTeam() {
  return <div className="max-w-xl">{await TeamPage()}</div>;
}
