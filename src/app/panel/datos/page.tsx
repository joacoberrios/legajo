import WorkshopDataPage from "@/app/taller/datos/page";

export default async function PanelData() {
  return <div className="max-w-xl">{await WorkshopDataPage()}</div>;
}
