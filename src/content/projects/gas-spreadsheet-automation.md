---
title: "定型業務の自動化（Google Apps Script）"
description: "Google Apps Script を使い、スプレッドシートの定型的な集計・転記・メール送信業務を自動化する事例集。"
tags: ["Google Apps Script", "Google Sheets", "Gmail", "自動化"]
createdAt: "2025-03-05"
updatedAt: "2025-03-05"
status: "published"
order: 20
---

## 課題

大学事務では、スプレッドシートのデータを別のシートやシステムに転記する、集計結果をメールで関係者に送る、期限が近づいたらリマインダーを送るといった定型業務が日常的に発生している。手作業で行うとミスが起きやすく、担当者の不在時に業務が滞ることもあった。

## 解決策

**Google Apps Script（GAS）** を使い、スプレッドシートを起点とした定型業務を自動化した。プログラミングの知識がなくても、基本的なスクリプトで多くの業務を効率化できる。

## 事例1: 申請一覧の自動集計・通知

各部署から届く申請データを月末に自動集計し、管理者にメールで報告する。

**GAS コード例:**

```javascript
function monthlySummaryReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName('申請一覧')
  const data = sheet.getDataRange().getValues()

  const today = new Date()
  const targetMonth = today.getMonth()

  const summary = { approved: 0, pending: 0, rejected: 0 }
  data.slice(1).forEach(row => {
    const date = new Date(row[1])
    if (date.getMonth() === targetMonth) {
      const status = row[5]
      if (status === '承認') summary.approved++
      else if (status === '保留') summary.pending++
      else if (status === '却下') summary.rejected++
    }
  })

  const body = [
    `${targetMonth + 1}月の申請状況をお知らせします。`,
    '',
    `承認: ${summary.approved}件`,
    `保留: ${summary.pending}件`,
    `却下: ${summary.rejected}件`,
    `合計: ${summary.approved + summary.pending + summary.rejected}件`,
  ].join('\n')

  GmailApp.sendEmail(
    'manager@example.ac.jp',
    `【月次報告】${targetMonth + 1}月の申請状況`,
    body
  )
}
```

## 事例2: 期限リマインダーの自動送信

スプレッドシートに登録された期限の3日前に、担当者へリマインダーメールを自動送信する。

**GAS コード例:**

```javascript
function sendDeadlineReminders() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName('タスク一覧')
  const data = sheet.getDataRange().getValues()
  const today = new Date()
  const threeDaysLater = new Date(
    today.getTime() + 3 * 24 * 60 * 60 * 1000
  )

  data.slice(1).forEach(row => {
    const taskName = row[0]
    const deadline = new Date(row[1])
    const email = row[2]
    const status = row[3]

    if (
      status !== '完了' &&
      deadline >= today &&
      deadline <= threeDaysLater
    ) {
      GmailApp.sendEmail(
        email,
        `【リマインダー】${taskName}の期限が近づいています`,
        `${taskName}の期限は${deadline.toLocaleDateString('ja-JP')}です。\n対応をお願いします。`
      )
    }
  })
}
```

## 事例3: データの自動転記

Google Form の回答データを、別のスプレッドシート（管理台帳）に自動で転記する。

**GAS コード例:**

```javascript
function onFormSubmit(e) {
  const response = e.values
  const targetSS = SpreadsheetApp.openById('管理台帳のID')
  const targetSheet = targetSS.getSheetByName('受付一覧')

  const newRow = [
    new Date(),
    response[1],
    response[2],
    response[3],
    '未対応',
  ]

  targetSheet.appendRow(newRow)
}
```

## 導入効果

| 項目 | 導入前 | 導入後 |
|------|--------|--------|
| 月次集計作業 | 1〜2 時間 | 自動（0 分） |
| リマインダー送信 | 手動で確認・送信 | 自動で送信 |
| データ転記 | 手作業（ミスあり） | 自動（ミスなし） |
| 担当者不在時 | 業務が滞る | 自動で継続 |

## 始め方

1. Google スプレッドシートを開く
2. メニューから「拡張機能」→「Apps Script」を選択
3. エディタにコードを貼り付ける
4. トリガーを設定（時間ベースまたはイベントベース）
5. 実行して動作確認

## 注意点

- GAS の実行時間には制限（1回あたり6分）があるため、大量データの処理は分割する
- メール送信には1日あたりの送信数制限がある
- スクリプトのエラー通知を設定し、異常終了に気づけるようにする
- 作成したスクリプトは、ドキュメントに処理内容を記録しておき、担当者の異動時に引き継げるようにする
