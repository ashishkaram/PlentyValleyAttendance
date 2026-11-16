import { POSITIONS, T20_CONDITIONS, T20_RULES, THRESHOLDS } from "../engine/config";
import { Card } from "./bits";

export function Reference() {
  const t = THRESHOLDS;
  const zones = [["close", "Close catchers"], ["ring", "Inside the circle"], ["deep", "Outside the circle"]] as const;
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-3 text-sm leading-relaxed">
      <Card title="T20 playing conditions (Rules of Premier Cricket, Rule 19)">
        <ul className="list-disc space-y-1 pl-5">
          <li>{T20_CONDITIONS.overs} overs an innings; a bowler may bowl at most {T20_CONDITIONS.maxBowlerOvers}.</li>
          <li><b>Powerplay:</b> overs {T20_CONDITIONS.powerplayOvers}, at most {T20_RULES.maxDeep.powerplay} fielders outside the circle.</li>
          <li><b>Power Surge:</b> two consecutive overs the batters call, starting between over 11 and over 19. If never called, they are overs 19–20. At most {T20_RULES.maxDeep.surge} fielders out.</li>
          <li><b>All other overs:</b> at most {T20_RULES.maxDeep.middle} fielders out.</li>
          <li>At most {T20_RULES.maxLegSide} fielders on the leg side, and at most {T20_RULES.maxBehindSquareLeg} behind square on the leg side.</li>
          <li>The circle is {T20_CONDITIONS.circleRadiusM} m from each middle stump; the boundary is at most {T20_CONDITIONS.maxBoundaryM} m from the centre of the pitch.</li>
          <li>One short-pitched ball per over. After a no-ball, the field may change for the free hit only if a different batter is on strike.</li>
          <li>Short leg and silly point must wear a helmet.</li>
        </ul>
        <p className="mt-2 text-slate-600">These are the same for Grades 1, 2 and 3. Grade 1 names 11 players; Grades 2 and 3 may name 12.</p>
      </Card>

      <Card title="How a field is built">
        <ol className="list-decimal space-y-1 pl-5">
          <li><b>Base field</b> for pace or spin in the chosen phase. A Finisher gets the death field in any phase except the Surge.</li>
          <li><b>Movement.</b> If the ball moves away from the batter, a slip-side catcher is added. If it moves in, a leg-side catcher is added. Off-spin turns in to a right-hander and away from a left-hander; leg-spin and left-arm orthodox do the opposite.</li>
          <li><b>Line.</b> {t.offChannel}% or more on or outside off stump moves a ring fielder to the off side. {t.legDrift}% or more on or outside leg stump moves one to the leg side and puts a fine leg out. Both at once is treated as sprayed, with no change.</li>
          <li><b>Length.</b> {t.shortHeavy}% or more short protects square of the wicket. {t.fullHeavy}% or more full protects straight.</li>
          <li><b>Short boundary and ball plan.</b> Deep fielders stay on the short side. A death-over ball plan replaces the length figures.</li>
          <li><b>Batter and match situation.</b> Aggressive batters get an extra boundary rider; new batters and tail-enders get an extra catcher.</li>
          <li><b>Laws.</b> The field is then trimmed to the limits above, and mirrored for a left-hander.</li>
        </ol>
        <p className="mt-2 text-slate-600">If a bowler has no line or length figures, steps 3 and 4 are skipped and she gets the generic field for her type of bowling.</p>
      </Card>

      <Card title="Line and length figures">
        <p><b>Line</b> is five percentages that total 100: outside off, off stump, middle stump, leg stump, outside leg — relative to the stumps of the batter faced.</p>
        <p className="mt-1"><b>Length</b> is three percentages that total 100: short, good length, full.</p>
        <p className="mt-1">Each bowler has an Overall set and may have a set for the Powerplay, Middle and Death. The Power Surge uses the Death set. A phase with no set of its own uses Overall.</p>
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
