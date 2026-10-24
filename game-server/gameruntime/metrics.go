package gameruntime

import (
	"math"
	"math/bits"
	"sync/atomic"
	"time"
)

// durationHistogram counts how long room work takes, in power-of-two microsecond buckets
// (bucket i holds durations below 2^i µs). Lock-free: every room goroutine records into it.
type durationHistogram struct {
	buckets [26]atomic.Uint64
	max     atomic.Int64
}

func (h *durationHistogram) observe(d time.Duration) {
	us := uint64(max(d.Microseconds(), 0))
	index := min(bits.Len64(us), len(h.buckets)-1)
	h.buckets[index].Add(1)
	for {
		current := h.max.Load()
		if int64(d) <= current || h.max.CompareAndSwap(current, int64(d)) {
			return
		}
	}
}

// snapshot reports the count and upper bounds of the 50th, 95th and 99th percentiles in
// milliseconds (bucket resolution: a factor of two), plus the exact maximum.
func (h *durationHistogram) snapshot() map[string]any {
	var counts [len(h.buckets)]uint64
	var total uint64
	for i := range h.buckets {
		counts[i] = h.buckets[i].Load()
		total += counts[i]
	}
	percentile := func(p float64) float64 {
		if total == 0 {
			return 0
		}
		target := uint64(math.Ceil(p * float64(total)))
		var seen uint64
		for i, count := range counts {
			seen += count
			if seen >= target {
				return float64(uint64(1)<<i) / 1000
			}
		}
		return float64(uint64(1)<<(len(counts)-1)) / 1000
	}
	return map[string]any{
		"count": total, "p50Ms": percentile(.50), "p95Ms": percentile(.95), "p99Ms": percentile(.99),
		"maxMs": float64(h.max.Load()) / float64(time.Millisecond),
	}
}

func (h *durationHistogram) reset() {
	for i := range h.buckets {
		h.buckets[i].Store(0)
	}
	h.max.Store(0)
}
