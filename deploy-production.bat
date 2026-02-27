@echo off
echo ======================================
echo 本番データベースを更新しています...
echo ======================================

echo.
echo [1/3] スキーマを適用中...
npx wrangler d1 execute othellonia_tournament_db --remote --file=schema.sql
if %errorlevel% neq 0 (
    echo エラー: スキーマの適用に失敗しました
    pause
    exit /b 1
)

echo.
echo [2/3] サンプルデータを投入中...
npx wrangler d1 execute othellonia_tournament_db --remote --file=insert_sample_data.sql
if %errorlevel% neq 0 (
    echo エラー: データの投入に失敗しました
    pause
    exit /b 1
)

echo.
echo [3/3] 本番サイトにデプロイ中...
npx wrangler pages deploy src
if %errorlevel% neq 0 (
    echo エラー: デプロイに失敗しました
    pause
    exit /b 1
)

echo.
echo ======================================
echo ✓ 本番環境の更新が完了しました！
echo ======================================
echo.
pause
