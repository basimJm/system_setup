package com.acme.shop.designsystem.theme

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp

/** Corner radii seen in the design: 6, 9, 14 (fields, buttons, cards), 16, 22, 26 (sheets) and pills. */
@Immutable
data class ShapeTokens(
    val extraSmall: Shape = RoundedCornerShape(6.dp),
    val small: Shape = RoundedCornerShape(9.dp),
    val medium: Shape = RoundedCornerShape(14.dp),
    val large: Shape = RoundedCornerShape(16.dp),
    val extraLarge: Shape = RoundedCornerShape(22.dp),
    val sheet: Shape = RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp),
    val pill: Shape = RoundedCornerShape(percent = 50),
    val circle: Shape = CircleShape,
)

val DefaultShapes = ShapeTokens()
