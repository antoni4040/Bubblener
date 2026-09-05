import type TimingStats from "@/utils/types/TimingStats";

const timingStats = storage.defineItem<TimingStats>('local:timingStats', {
    defaultValue: {},
});

export default timingStats;
