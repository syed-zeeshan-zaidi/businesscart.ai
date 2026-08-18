package generator

import (
	"sort"
	"testing"
)

// Go randomises map iteration order, so any slice built by ranging a map and
// then rendered is nondeterministic unless it is sorted. That made every regen
// produce different bytes for an unchanged catalogue, which churned S3 and
// CloudFront for nothing and made byte-diff verification of a storefront change
// impossible.
//
// This asserts the property directly: build the category slice the way the
// generator does, many times, and require one stable answer.
func TestCategoryOrderIsDeterministic(t *testing.T) {
	counts := map[string]int{
		"Gloves / BBQ": 4, "Gloves / Welding": 9, "Oven Mitts": 4,
		"Aprons": 2, "Gloves / Winter": 7, "Sports": 4,
	}
	var first []string
	for run := 0; run < 50; run++ {
		var cats []string
		for c := range counts {
			cats = append(cats, c)
		}
		sort.Strings(cats)
		if run == 0 {
			first = cats
			continue
		}
		for i := range cats {
			if cats[i] != first[i] {
				t.Fatalf("run %d produced a different order: %v vs %v", run, cats, first)
			}
		}
	}
}

// The footer's top-categories list sorts by product count, and sort.Slice is not
// stable, so equal counts kept whatever random order the map range produced.
// "Gloves / BBQ", "Oven Mitts" and "Sports" all have 4 here, which is exactly the
// case that used to shuffle.
func TestTopCategoryTieBreakIsDeterministic(t *testing.T) {
	counts := map[string]int{
		"Gloves / BBQ": 4, "Oven Mitts": 4, "Sports": 4, "Gloves / Welding": 9, "Aprons": 2,
	}
	var first []string
	for run := 0; run < 50; run++ {
		var ps []string
		for p := range counts {
			ps = append(ps, p)
		}
		sort.Slice(ps, func(i, j int) bool {
			if counts[ps[i]] != counts[ps[j]] {
				return counts[ps[i]] > counts[ps[j]]
			}
			return ps[i] < ps[j]
		})
		if run == 0 {
			first = ps
			continue
		}
		for i := range ps {
			if ps[i] != first[i] {
				t.Fatalf("run %d reshuffled tied counts: %v vs %v", run, ps, first)
			}
		}
	}
	if first[0] != "Gloves / Welding" {
		t.Fatalf("highest count must still lead, got %v", first)
	}
}
