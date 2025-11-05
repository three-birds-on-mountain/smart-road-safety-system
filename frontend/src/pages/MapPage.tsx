const MapPage = () => (
  <section className="flex flex-1 flex-col gap-lg">
    <header className="flex flex-col gap-sm">
      <h1 className="text-3xl font-semibold text-primary-700">
        即時危險區域警示
      </h1>
      <p className="max-w-2xl text-base text-text-secondary">
        透過 GPS 監測與交通事故熱點資料，提供駕駛者即時的危險路段提醒。
        地圖與警示流程將在後續任務中串接後端服務與感測器資料。
      </p>
    </header>

    <div className="flex flex-1 flex-col gap-md rounded-lg bg-surface-white p-lg shadow-md">
      <div className="grid min-h-[320px] place-items-center rounded-md border border-gray-100 bg-surface-muted text-text-secondary">
        地圖模組開發中...
      </div>
      <p className="text-sm text-text-description">
        地圖元件（Mapbox GL JS）與熱點層將在 User Story 3 任務中完成。
      </p>
    </div>
  </section>
);

export default MapPage;
