const SettingsPage = () => (
  <section className="flex flex-1 flex-col gap-lg">
    <header className="flex flex-col gap-sm">
      <h1 className="text-3xl font-semibold text-primary-700">警示設定</h1>
      <p className="max-w-2xl text-base text-text-secondary">
        客製化提醒距離、事故等級與時間範圍，打造最符合行車習慣的安全系統。表單與資料串接將隨
        US2 任務逐步補齊。
      </p>
    </header>

    <div className="grid gap-lg md:grid-cols-2">
      <div className="rounded-lg bg-surface-white p-lg shadow-md">
        <h2 className="text-xl font-semibold text-text-primary">提醒距離</h2>
        <p className="mt-sm text-sm text-text-description">
          預設提醒距離為 500 公尺。完成設定元件後，將可在此調整距離選項。
        </p>
      </div>

      <div className="rounded-lg bg-surface-white p-lg shadow-md">
        <h2 className="text-xl font-semibold text-text-primary">事故等級</h2>
        <p className="mt-sm text-sm text-text-description">
          支援 A1/A2/A3 事故等級選擇。後續將以 Checkbox 元件呈現多選。
        </p>
      </div>

      <div className="rounded-lg bg-surface-white p-lg shadow-md md:col-span-2">
        <h2 className="text-xl font-semibold text-text-primary">提醒方式與時間範圍</h2>
        <p className="mt-sm text-sm text-text-description">
          可選擇音效、震動或僅顯示視覺提醒，並設定事故時間範圍（一年內、半年內、三個月、一個月）。
          相關邏輯將在 US2 任務整合。
        </p>
      </div>
    </div>
  </section>
);

export default SettingsPage;
