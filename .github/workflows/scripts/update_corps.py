name: DART 기업 목록 업데이트

on:
  schedule:
    - cron: '0 0 * * 1'   # 매주 월요일 자정 자동 실행
  workflow_dispatch:        # GitHub에서 수동 실행 가능

jobs:
  update-corps:
    runs-on: ubuntu-latest
    steps:
      - name: 저장소 체크아웃
        uses: actions/checkout@v4

      - name: Python 설정
        uses: actions/setup-python@v5
        with:
          python-version: '3.x'

      - name: 패키지 설치
        run: pip install requests

      - name: DART 기업 목록 다운로드 및 파싱
        run: python scripts/update_corps.py
        env:
          DART_API_KEY: ${{ secrets.DART_API_KEY }}

      - name: 변경사항 커밋 및 푸시
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add corps.json
          git diff --staged --quiet || git commit -m "chore: DART 기업 목록 업데이트"
          git push
