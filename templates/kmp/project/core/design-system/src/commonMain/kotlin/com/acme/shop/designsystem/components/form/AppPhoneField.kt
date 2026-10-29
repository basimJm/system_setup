package com.acme.shop.designsystem.components.form

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDirection
import com.acme.shop.designsystem.components.image.AppImage
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.components.textfield.AppTextField
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.country_change_description
import com.acme.shop.designsystem.theme.AppTheme
import org.jetbrains.compose.resources.stringResource

/** One country of the server list (`GET /locations/countries`): the regex is applied by the ViewModel, not here. */
@Immutable
data class CountryUi(
    val code: String,
    val name: String,
    val dialCode: String,
    val flagUrl: String?,
    val phoneRegex: String,
)

/** Keyboard presets so forms never repeat `KeyboardOptions` literals. */
object AppKeyboards {
    val phone = KeyboardOptions(keyboardType = KeyboardType.Phone, imeAction = ImeAction.Done)
    val email = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next)
    val name = KeyboardOptions(
        keyboardType = KeyboardType.Text,
        capitalization = KeyboardCapitalization.Words,
        imeAction = ImeAction.Next,
    )
    val number = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done)
}

/**
 * Mobile number field with the country chip at the start (flag + dial code, tap opens the picker) and
 * left-to-right digits in both languages. Validation (country regex) and its message come from the caller.
 */
@Composable
fun AppPhoneField(
    value: String,
    onValueChange: (String) -> Unit,
    country: CountryUi?,
    onCountryClick: () -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String? = null,
    error: String? = null,
    enabled: Boolean = true,
) {
    AppTextField(
        value = value,
        onValueChange = { onValueChange(it.filter(Char::isDigit)) },
        modifier = modifier,
        label = label,
        placeholder = placeholder,
        error = error,
        enabled = enabled,
        keyboardOptions = AppKeyboards.phone,
        textDirection = TextDirection.Ltr,
        leading = { CountryChip(country = country, onClick = onCountryClick, enabled = enabled) },
    )
}

@Composable
private fun CountryChip(country: CountryUi?, onClick: () -> Unit, enabled: Boolean, modifier: Modifier = Modifier) {
    val description = stringResource(Res.string.country_change_description)
    Row(
        modifier = modifier.clickable(enabled = enabled, role = Role.Button, onClickLabel = description, onClick = onClick),
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space6),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CountryFlag(country?.flagUrl)
        AppText(text = country?.dialCode.orEmpty(), style = AppTheme.typography.bodyLarge, maxLines = 1)
        Icon(
            imageVector = AppIcons.ExpandMore,
            contentDescription = null,
            tint = AppTheme.colors.muted,
            modifier = Modifier.size(AppTheme.sizes.iconSmall),
        )
    }
}

@Composable
internal fun CountryFlag(url: String?, modifier: Modifier = Modifier) {
    val shaped = modifier.size(AppTheme.sizes.iconLarge).clip(AppTheme.shapes.small)
    if (url != null) AppImage(url = url, modifier = shaped)
}
