<!DOCTYPE html>
<html lang="ja">
  <head>
    <base target="_top">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>入浴タイムスタンプ記録</title>
    <?!= include('Stylesheet'); ?>
  </head>
  <body>
    <main class="app">
      <header class="app-header">
        <h1>入浴タイムスタンプ記録</h1>
        <p class="subtext">利用者と担当者を選び、工程ボタンを押すだけで記録します。</p>
      </header>

      <section class="card form-card">
        <label class="field">
          <span class="field-label">利用者</span>
          <select id="residentSelect" class="input" aria-label="利用者"></select>
        </label>

        <div class="selected-resident" aria-live="polite">
          <span class="selected-resident-label">選択中の利用者</span>
          <strong id="selectedResidentName" class="selected-resident-value">まだ選択されていません</strong>
        </div>

        <label class="field">
          <span class="field-label">担当者名</span>
          <input id="staffName" class="input" type="text" placeholder="例: 田中" maxlength="40" autocomplete="name">
        </label>

        <label class="field">
          <span class="field-label">メモ（任意）</span>
          <input id="memo" class="input" type="text" placeholder="特記事項があれば入力" maxlength="80">
        </label>
      </section>

      <section class="button-grid" id="eventButtons" aria-label="記録ボタン"></section>

      <section class="card status-card">
        <div class="status-row status-row-main">
          <span class="status-label">状態</span>
          <strong id="statusText" class="status-text">利用者と担当者を入力してください</strong>
        </div>
        <div class="status-row">
          <span class="status-label">直近の記録</span>
          <strong id="lastRecordText">まだ記録はありません</strong>
        </div>
      </section>
    </main>

    <?!= include('JavaScript'); ?>
  </body>
</html>
