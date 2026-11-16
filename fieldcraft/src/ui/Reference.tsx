import { CONDITIONS, GROUND, ONEDAY_RULES, POSITIONS, T20_RULES, THRESHOLDS } from "../engine/config";
import { FORMAT } from "../format";
import { Card } from "./bits";

function T20Conditions() {
  const c = CONDITIONS.t20["1"];
  const r = T20_RULES;
  return (
    <Card title="T20 playing conditions (Rules of Premier Cricket, Rule 19)">
      <ul className="list-disc space-y-1 pl-5">
        <li>{c.overs} overs an innings; a bowler may bowl at most {c.maxBowlerOvers}.</li>
        <li><b>Powerplay:</b> overs 1–{c.powerplayEnd}, at most {r.maxDeep.powerplay} fielders outside the circle.</li>
        <li><b>Power Surge:</b> two consecutive overs the batters call, starting between over 11 and over 19. If never called, they are overs 19–20. At most {r.maxDeep.surge} fielders out.</li>
        <li><b>All other overs:</b> at most {r.maxDeep.middle} fielders out.</li>
        <li>One short-pitched ball per over.</li>
      </ul>
      <p className="mt-2 text-slate-600">These are the same for Grades 1, 2 and 3.</p>
    </Card>
  );
}

function OneDayConditions() {
  const r = ONEDAY_RULES;
  return (
    <Card title="One-Day playing conditions (Rules of Premier Cricket, Rule 17)">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-300 text-xs text-slate-500 uppercase">
            <th className="py-1"> </th><th>Grade 1</th><th>Grade 2</th><th>Grade 3</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["Overs", (g) => `${CONDITIONS.oneday[g].overs}`],
            ["Powerplay", (g) => `1–${CONDITIONS.oneday[g].powerplayEnd}`],
            ["Overs per bowler", (g) => `${CONDITIONS.oneday[g].maxBowlerOvers}`],
          ] as [string, (g: "1" | "2" | "3") => string][]).map(([label, f]) => (
            <tr key={label} className="border-b border-slate-200">
              <th className="py-1.5 font-semibold">{label}</th><td>{f("1")}</td><td>{f("2")}</td><td>{f("3")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li><b>Powerplay:</b> at most {r.maxDeep.powerplay} fielders outside the circle.</li>
        <li><b>Every other over:</b> at most {r.maxDeep.middle} fielders out. There is no five-out block at the end.</li>
        <li>"Death" in this app means the last fifth of the innings. The limit is the same as the middle overs; only the starting field changes.</li>
        <li>Two fast short-pitched balls above shoulder height are allowed per over.</li>
        <li>In a shortened match the powerplay and bowler limits shrink (Rule 17.9.5). The app does not work this out; pick the phase that applies.</li>
      </ul>
    </Card>
  );
}

export function Reference() {
  const t = THRESHOLDS;
  const r = FORMAT === "t20" ? T20_RULES : ONEDAY_RULES;
  const zones = [["close", "Close catchers"], ["ring", "Inside the circle"], ["deep", "Outside the circle"]] as const;
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-3 text-sm leading-relaxed">
      {FORMAT === "t20" ? <T20Conditions /> : <OneDayConditions />}

      <Card title="Both formats">
        <ul className="list-disc space-y-1 pl-5">
          <li>At most {r.maxLegSide} fielders on the leg side, and at most {r.maxBehindSquareLeg} behind square on the leg side.</li>
          <li>The circle is {GROUND.circleRadiusM} m from each middle stump; the boundary is at most {GROUND.maxBoundaryM} m from the centre of the pitch.</li>
          <li>After a no-ball, the field may change for the free hit only if a different batter is on strike.</li>
          <li>Short leg and silly point must wear a helmet.</li>
          <li>Grade 1 names 11 players; Grades 2 and 3 may name 12.</li>
        </ul>
      </Card>

      <Card title="How a field is built">
        <ol className="list-decimal space-y-1 pl-5">
          <li><b>Base field</b> for pace or spin in the chosen phase. A Finisher gets the death field{FORMAT === "t20" ? " in any phase except the Surge" : " in any phase"}.</li>
          <li><b>Movement.</b> If the ball moves away from the batter, a slip-side catcher is added. If it moves in, a leg-side catcher is added. Off-spin turns in to a right-hander and away from a left-hander; leg-spin and left-arm orthodox do the opposite.{FORMAT === "oneday" && " With the old ball reversing, a pace bowler's movement is flipped."}</li>
          <li><b>Line.</b> {t.offChannel}% or more on or outside off stump moves a ring fielder to the off side. {t.legDrift}% or more on or outside leg stump moves one to the leg side and puts a fine leg out. Both at once is treated as sprayed, with no change.</li>
          <li><b>Length.</b> {t.shortHeavy}% or more short protects square of the wicket. {t.fullHeavy}% or more full protects straight.</li>
          {FORMAT === "t20" && <li><b>Short boundary and ball plan.</b> Deep fielders stay on the short side. A death-over ball plan replaces the length figures.</li>}
          <li><b>Batter and match situation.</b> Aggressive batters get an extra boundary rider; new batters and tail-enders get an extra catcher.</li>
          <li><b>Laws.</b> The field is then trimmed to the limits above, and mirrored for a left-hander.</li>
        </ol>
        <p className="mt-2 text-slate-600">No step takes the last infielder from either side of the wicket. If a bowler has no line or length figures, steps 3 and 4 are skipped and she gets the generic field for her type of bowling.</p>
      </Card>

      <Card title="Line and length figures">
        <p><b>Line</b> is five percentages that total 100: outside off, off stump, middle stump, leg stump, outside leg — relative to the stumps of the batter faced.</p>
        <p className="mt-1"><b>Length</b> is three percentages that total 100: short, good length, full.</p>
        <p className="mt-1">Each bowler has an Overall set and may have a set for the Powerplay, Middle and Death.{FORMAT === "t20" && " The Power Surge uses the Death set."} A phase with no set of its own uses Overall. T20 and One-Day figures are kept separately; if this format has none, the other format's Overall figures are used and the map says so.</p>
      </Card>

      <Card title="Positions">
        {zones.map(([zone, label]) => (
          <p key={zone} className="mt-1">
            <b>{label}:</b> {POSITIONS.filter((p) => p.zone === zone).map((p) => p.name.toLowerCase()).join(", ")}.
          </p>
        ))}
      </Card>
    </div>
  );
}
