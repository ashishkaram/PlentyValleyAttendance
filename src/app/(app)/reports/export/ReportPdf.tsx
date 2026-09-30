import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDisplayDate } from "@/lib/domain/dates";
import type { Report } from "@/lib/domain/reports";
import { formatPercent } from "@/lib/domain/attendance";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#0f172a" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4, color: "#065f46" },
  subtitle: { fontSize: 10, marginBottom: 2, color: "#334155" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cbd5e1", paddingVertical: 3 },
  head: { fontFamily: "Helvetica-Bold", backgroundColor: "#ecfdf5" },
  low: { backgroundColor: "#fee2e2" },
  num: { width: 28 },
  name: { flexGrow: 1, flexBasis: 0 },
  cell: { width: 34, textAlign: "right" },
  sep: { borderLeftWidth: 0.5, borderLeftColor: "#94a3b8" },
  group: { flexDirection: "row", marginTop: 10 },
  footer: { marginTop: 10, fontSize: 8, color: "#475569" },
});

export function ReportPdf({
  report,
  label,
  threshold,
  seasonName,
}: {
  report: Report;
  label: string;
  threshold: number;
  seasonName: string;
}) {
  const cols = ["Held", "Present", "Absent", "Excused", "Injured", "%"];
  return (
    <Document title={`Attendance ${report.range.start} to ${report.range.end}`} author="Plenty Valley">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Training attendance — {seasonName}</Text>
        <Text style={styles.subtitle}>
          {label}: {formatDisplayDate(report.range.start)} – {formatDisplayDate(report.range.end)} ({report.sessionsInRange.length} session{report.sessionsInRange.length === 1 ? "" : "s"})
        </Text>
        <Text style={styles.subtitle}>
          Season to date: {formatDisplayDate(report.seasonRange.start)} – {formatDisplayDate(report.seasonRange.end)}
        </Text>

        <View style={styles.group}>
          <Text style={[styles.num]} />
          <Text style={[styles.name]} />
          <Text style={[{ width: 34 * 6, textAlign: "center", fontFamily: "Helvetica-Bold" }, styles.sep]}>{label}</Text>
          <Text style={[{ width: 34 * 6, textAlign: "center", fontFamily: "Helvetica-Bold" }, styles.sep]}>Season to date</Text>
        </View>
        <View style={[styles.row, styles.head]} fixed>
          <Text style={styles.num}>#</Text>
          <Text style={styles.name}>Name</Text>
          {[...cols, ...cols].map((c, i) => (
            <Text key={i} style={i % 6 === 0 ? [styles.cell, styles.sep] : styles.cell}>{c}</Text>
          ))}
        </View>
        {report.rows.map((r) => (
          <View key={r.player.id} style={r.low ? [styles.row, styles.low] : styles.row} wrap={false}>
            <Text style={styles.num}>{r.player.player_number ?? ""}</Text>
            <Text style={styles.name}>
              {r.player.name}
              {r.player.is_active ? "" : " (inactive)"}
              {r.low ? `  — below ${threshold}%` : ""}
            </Text>
            {[r.range, r.season].flatMap((s, g) => [
              <Text key={`${g}h`} style={[styles.cell, styles.sep]}>{s.held}</Text>,
              <Text key={`${g}p`} style={styles.cell}>{s.present}</Text>,
              <Text key={`${g}a`} style={styles.cell}>{s.absent}</Text>,
              <Text key={`${g}e`} style={styles.cell}>{s.excused}</Text>,
              <Text key={`${g}i`} style={styles.cell}>{s.injured}</Text>,
              <Text key={`${g}%`} style={[styles.cell, { fontFamily: "Helvetica-Bold" }]}>{formatPercent(s.pct)}</Text>,
            ])}
          </View>
        ))}
        <Text style={styles.footer}>
          % = present ÷ (present + absent), rounded half up. Excused, injured, cancelled and unrecorded sessions and sessions outside a player&apos;s squad periods are not counted. Highlighted rows are below {threshold}% for the season.
        </Text>
      </Page>
    </Document>
  );
}
