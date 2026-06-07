export const EOL_DATES: Record<string, { version: string; eolDate: string }[]> = {
  node: [
    { version: '16', eolDate: '2023-09-11' },
    { version: '18', eolDate: '2025-04-30' },
    { version: '20', eolDate: '2026-04-30' },
    { version: '22', eolDate: '2027-04-30' },
  ],
  python: [
    { version: '3.8', eolDate: '2024-10' },
    { version: '3.9', eolDate: '2025-10' },
    { version: '3.10', eolDate: '2026-10' },
    { version: '3.11', eolDate: '2027-10' },
    { version: '3.12', eolDate: '2028-10' },
    { version: '3.13', eolDate: '2029-10' },
  ],
  java: [
    { version: '8', eolDate: '2025-03' },
    { version: '11', eolDate: '2026-01' },
    { version: '17', eolDate: '2027-10' },
    { version: '21', eolDate: '2028-09' },
  ],
  npm: [
    { version: '6', eolDate: '2022-09' },
    { version: '7', eolDate: '2023-02' },
    { version: '8', eolDate: '2024-09' },
    { version: '9', eolDate: '2025-06' },
    { version: '10', eolDate: '2026-04' },
    { version: '11', eolDate: '2027-06' },
  ],
}
