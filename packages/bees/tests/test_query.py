# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import unittest
from pathlib import Path
from bees.ticket import Ticket, TicketMetadata
from app.server import should_include_ticket


class TestQueryParser(unittest.TestCase):
    def setUp(self):
        self.ticket = Ticket(
            id="test-id",
            objective="test objective",
            dir=Path("/tmp/test-ticket"),
            metadata=TicketMetadata(
                status="available",
                tags=["foo", "bar"],
                kind="work",
                created_at="2026-03-30T12:00:00Z"
            )
        )

    def test_no_filters(self):
        self.assertTrue(should_include_ticket(self.ticket))

    def test_status_filter_positive_match(self):
        self.assertTrue(should_include_ticket(self.ticket, status="available"))

    def test_status_filter_positive_no_match(self):
        self.assertFalse(should_include_ticket(self.ticket, status="running"))

    def test_status_filter_positive_multiple_match(self):
        self.assertTrue(should_include_ticket(self.ticket, status="running,available"))

    def test_status_filter_negative_match(self):
        self.assertFalse(should_include_ticket(self.ticket, status="!available"))

    def test_status_filter_negative_no_match(self):
        self.assertTrue(should_include_ticket(self.ticket, status="!running"))

    def test_tags_filter_positive_match(self):
        self.assertTrue(should_include_ticket(self.ticket, tags="foo"))
        self.assertTrue(should_include_ticket(self.ticket, tags="bar"))

    def test_tags_filter_positive_no_match(self):
        self.assertFalse(should_include_ticket(self.ticket, tags="baz"))

    def test_tags_filter_negative_match(self):
        self.assertFalse(should_include_ticket(self.ticket, tags="!foo"))

    def test_tags_filter_negative_no_match(self):
        self.assertTrue(should_include_ticket(self.ticket, tags="!baz"))

    def test_kind_filter_positive_match(self):
        self.assertTrue(should_include_ticket(self.ticket, kind="work"))

    def test_kind_filter_positive_no_match(self):
        self.assertFalse(should_include_ticket(self.ticket, kind="coordination"))

    def test_kind_filter_negative_match(self):
        self.assertFalse(should_include_ticket(self.ticket, kind="!work"))

    def test_kind_filter_negative_no_match(self):
        self.assertTrue(should_include_ticket(self.ticket, kind="!coordination"))

    def test_combined_filters(self):
        self.assertTrue(should_include_ticket(self.ticket, status="available", tags="!baz", kind="work"))
        self.assertFalse(should_include_ticket(self.ticket, status="available", tags="!foo", kind="work"))


if __name__ == "__main__":
    unittest.main()
