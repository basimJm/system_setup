package com.acme.shop.designsystem.components.rating

const val RATING_MAX_STARS = 5

/** How much of star [index] (0-based) is filled for [rating]: 0f empty, 1f full, in between partial. Pure and tested. */
fun starFill(index: Int, rating: Float): Float = (rating - index).coerceIn(0f, 1f)
