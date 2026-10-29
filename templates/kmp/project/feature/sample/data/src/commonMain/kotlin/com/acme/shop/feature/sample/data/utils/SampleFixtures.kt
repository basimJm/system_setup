package com.acme.shop.feature.sample.data.utils

import com.acme.shop.core.data.mock.MOCK_TEXT_MARKER

/** Mock responses of the sample endpoints (backend envelope); the text marker becomes sample text in the app language. */
object SampleFixtures {
    const val QUALIFIER = "sample_items_fixture"
    const val METHOD_GET = "GET"
    const val ITEMS = """{"success":true,"message":"","data":[""" +
        """{"id":1,"title":"$MOCK_TEXT_MARKER 1","description":"$MOCK_TEXT_MARKER"},""" +
        """{"id":2,"title":"$MOCK_TEXT_MARKER 2","description":"$MOCK_TEXT_MARKER"},""" +
        """{"id":3,"title":"$MOCK_TEXT_MARKER 3","description":"$MOCK_TEXT_MARKER"}]}"""
}
