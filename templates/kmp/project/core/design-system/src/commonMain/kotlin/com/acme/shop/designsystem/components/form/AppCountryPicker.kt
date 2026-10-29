package com.acme.shop.designsystem.components.form

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import com.acme.shop.designsystem.components.dialog.AppFullScreenSheet
import com.acme.shop.designsystem.components.feedback.AppEmptyState
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.components.textfield.AppSearchBar
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.country_empty
import com.acme.shop.designsystem.resources.country_picker_title
import com.acme.shop.designsystem.resources.country_search_placeholder
import com.acme.shop.designsystem.theme.AppTheme
import org.jetbrains.compose.resources.stringResource

private const val COUNTRY_ROW_TYPE = "country"

/** Case-insensitive match on the localized name or the dial code (with or without the plus sign); blank query = all. */
fun filterCountries(countries: List<CountryUi>, query: String): List<CountryUi> {
    val needle = query.trim().removePrefix("+")
    if (needle.isEmpty()) return countries
    return countries.filter { country ->
        country.name.contains(needle, ignoreCase = true) || country.dialCode.removePrefix("+").startsWith(needle)
    }
}

/** Full-screen country sheet (, ): search, flag + name + dial code rows, the selected one marked. */
@Composable
fun AppCountryPicker(
    countries: List<CountryUi>,
    selectedCode: String?,
    onSelect: (CountryUi) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var query by rememberSaveable { mutableStateOf("") }
    val visible = remember(countries, query) { filterCountries(countries, query) }
    AppFullScreenSheet(title = stringResource(Res.string.country_picker_title), onClose = onDismiss, modifier = modifier) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppSearchBar(
                value = query,
                onValueChange = { query = it },
                placeholder = stringResource(Res.string.country_search_placeholder),
                modifier = Modifier.padding(AppTheme.adaptive.horizontalPadding),
            )
            if (visible.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    AppEmptyState(title = stringResource(Res.string.country_empty))
                }
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(visible, key = { it.code }, contentType = { COUNTRY_ROW_TYPE }) { country ->
                        CountryRow(country, selected = country.code == selectedCode, onClick = { onSelect(country) })
                    }
                }
            }
        }
    }
}

@Composable
private fun CountryRow(country: CountryUi, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val spacing = AppTheme.spacing
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = AppTheme.adaptive.horizontalPadding, vertical = spacing.space12),
        horizontalArrangement = Arrangement.spacedBy(spacing.space12),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CountryFlag(country.flagUrl)
        AppText(text = country.name, modifier = Modifier.weight(1f), maxLines = 1)
        AppText(text = country.dialCode, color = AppTheme.colors.muted, maxLines = 1)
        if (selected) Icon(AppIcons.Check, contentDescription = null, tint = AppTheme.colors.accent)
    }
}
