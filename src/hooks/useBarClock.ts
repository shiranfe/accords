import { useEffect, useRef, useState } from "react";

type Options = {
  bpm: number;
  beatsPerBar: number;
  running: boolean;
  muted: boolean;
  /** Bumping this restarts the count from the top. Every start has to carry a
   *  fresh number: it is also what tells a stale beat from a live one. */
  session?: number;
};

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** How far ahead beats are scheduled, and how often the scheduler looks. */
const LOOKAHEAD = 0.15;
/**
 * A hidden tab gets its timers throttled to about one a second, which with the
 * ordinary lookahead leaves gaps in the click. Scheduling further ahead while
 * the page is out of sight keeps the metronome steady when the screen locks
 * mid-practice; the cost is that a tempo change lands a beat or two later,
 * and nobody is dragging the tempo slider on a page they cannot see.
 */
const HIDDEN_LOOKAHEAD = 1.5;
const TICK_MS = 25;

/**
 * A metronome that counts beats. setInterval alone drifts audibly within a
 * few bars, so the clicks are scheduled on the audio clock ahead of time and
 * the interval only tops the queue up; the number React renders is the beat
 * whose click has actually sounded.
 *
 * Returns the beat count since start, -1 before the first beat. Tempo changes
 * take effect on the next scheduled beat, without restarting the count.
 */
export function useBarClock({ bpm, beatsPerBar, running, muted, session = 0 }: Options): number {
  // Stamped with the run it belongs to, so the beat left over from the last
  // run is never shown for the frames before the new one has ticked.
  const [tick, setTick] = useState({ session: -1, beat: -1 });
  const ctxRef = useRef<AudioContext | null>(null);
  const bpmRef = useRef(bpm);
  const barRef = useRef(beatsPerBar);
  const mutedRef = useRef(muted);
  // Read by the scheduler, which is not re-created on every render: tempo and
  // mute change what the *next* beat does, without restarting the count.
  useEffect(() => {
    bpmRef.current = bpm;
    barRef.current = beatsPerBar;
    mutedRef.current = muted;
  });

  useEffect(() => {
    if (!running) {
      void ctxRef.current?.suspend();
      return;
    }

    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) return;
    const ctx = ctxRef.current ?? new Ctor();
    ctxRef.current = ctx;
    void ctx.resume();

    let nextBeat = 0;
    let nextTime = ctx.currentTime + 0.12;
    const queue: { beat: number; time: number }[] = [];

    const click = (time: number, accent: boolean) => {
      if (mutedRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = accent ? 1500 : 900;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.25, time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.09);
    };

    const timer = window.setInterval(() => {
      const ahead = document.hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD;
      while (nextTime < ctx.currentTime + ahead) {
        click(nextTime, nextBeat % barRef.current === 0);
        queue.push({ beat: nextBeat, time: nextTime });
        nextTime += 60 / bpmRef.current;
        nextBeat += 1;
      }
      // The beat on screen is moved on from here and not from an animation
      // frame: a hidden tab stops handing out frames, and the drill would go
      // on clicking with the chords frozen on the one it left off at.
      let sounded = -1;
      while (queue.length && queue[0].time <= ctx.currentTime) {
        sounded = (queue.shift() as { beat: number }).beat;
      }
      if (sounded >= 0) setTick({ session, beat: sounded });
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [running, session]);

  return running && tick.session === session ? tick.beat : -1;
}
