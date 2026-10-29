package com.acme.shop.core.analytics

private const val ARGS_START = '/'
private const val QUERY_START = '?'
private const val PACKAGE_SEPARATOR = '.'
private const val NESTED_SEPARATOR = '$'
private const val SNAKE = '_'

/** Analytics screen names derived from typed navigation routes, so every route is tracked without per-screen wiring. */
object AnalyticsScreenNames {

    /**
     * `com.acme.shop.core.navigation.route.Screen.ItemDetails/{itemId}` → `item_details`;
     * nested or anonymous classes keep their last simple name. Null for an empty route.
     */
    fun fromRoute(route: String?): String? {
        val typeName = route.orEmpty()
            .substringBefore(ARGS_START)
            .substringBefore(QUERY_START)
            .substringAfterLast(PACKAGE_SEPARATOR)
            .substringAfterLast(NESTED_SEPARATOR)
        if (typeName.isBlank()) return null
        return buildString {
            typeName.forEachIndexed { index, char ->
                if (char.isUpperCase() && index > 0 && !typeName[index - 1].isUpperCase()) append(SNAKE)
                append(char.lowercaseChar())
            }
        }
    }
}
