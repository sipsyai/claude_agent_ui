# Content-type Builder

**Source:** https://docs.strapi.io/cms/features/content-type-builder
**Downloaded:** 2025-10-31

---

# Content-type Builder

> The Content-type Builder is a tool for designing content types and components. This documentation gives an overview of the Content-type Builder and covers field options, relations, component usage, and shares data modeling tips.

From the Content-type Builder, accessible via the main navigation of the admin panel, users can create and edit their content types.

## Overview

The Content-type Builder allows the creation and management of content-types, which can be:

- **Collection types**: content-types that can manage several entries.
- **Single types**: content-types that can only manage one entry.
- **Components**: content structure that can be used in multiple collection types and single types.

All 3 are displayed as categories in the sub navigation of the Content-type Builder. In each category are listed all content-types and components that have already been created.

### Status Indicators

The following statuses can be displayed:

- `New` or `N` indicates that a content-type/component or field is new and hasn't been saved yet
- `Modified` or `M` indicates that a content-type/component or field has been modified since the last save
- `Deleted` or `D` indicates that a content-type/component or field has been deleted but will only be confirmed once saved

## Usage

### Creating Content-types

#### Creating content-types with Strapi AI

When enabled, Strapi AI adds an assistant that helps you create or edit content types with natural language. Click on the button in the bottom right corner of the admin panel and describe what you need.

You can also use the button at the bottom of the chat window to:
- Import code from an existing Strapi or front-end application
- Import a Figma project
- Attach an image to extract the content structure from a design

**Strapi AI credits**: Includes 1,000 credits per month on the Growth plan, and 10 free credits during the free trial.

#### Creating content-types manually

1. Choose whether you want to create a collection type or a single type.
2. In the Content-type Builder's category, click on **Create new collection/single type**.
3. In the content-type creation window, write the name of the new content-type in the _Display name_ textbox.
4. Check the _API ID_ to make sure the automatically pre-filled values are correct.
5. (optional) In the Advanced Settings tab, configure the available settings for the new content-type:
   - **Draft & publish**: Allow entries to be managed as draft versions before publication
   - **Internationalization**: Allow entries to be translated into other locales
6. Click on the **Continue** button.
7. Add and configure chosen fields for your content-type.
8. Click on the **Save** button.

#### Creating a New Component

1. In the Components category of the Content-type Builder sub navigation, click on **Create new component**.
2. In the component creation window, configure the basic settings:
   - Write the name of the component in the _Display name_ textbox
   - Select an available category, or enter a new category name
   - (optional) Choose an icon representing the new component
3. Click on the **Continue** button.
4. Add and configure chosen fields for your component.
5. Click on the **Save** button.

### Editing Content-types

#### Settings

1. Click on the **Edit** button of your content-type to access its settings.
2. Edit the available settings of your choice:

**Basic settings:**
- **Display name**: Name as displayed in the admin panel
- **API ID (singular)**: Name as used in the API
- **API ID (plural)**: Plural name as used in the API
- **Type**: Either a Collection type or a Single type

**Advanced settings:**
- **Draft & Publish**: Enable the Draft & Publish feature (disabled by default)
- **Internationalization**: Enable the Internationalization feature (disabled by default)

3. Click the **Finish** button in the dialog.
4. Click the **Save** button in the Content-Type Builder navigation.

#### Fields

From the table that lists the fields of your content-type, you can:

- Click on the button to access a field's basic and advanced settings to edit them
- Click on the **Add another field** buttons to create a new field
- Click on the button and drag and drop any field to reorder fields
- Click on the button to delete a field

### Configuring Content-types Fields

Content-types are composed of one or several fields. Each field is designed to contain specific kinds of data.

#### Text

The Text field displays a textbox that can contain small text. This field can be used for titles, descriptions, etc.

**Basic settings:**
- **Name**: Write the name of the Text field
- **Type**: Choose between _Short text_ (255 characters maximum) and _Long text_

**Advanced settings:**
- **Default value**: Write the default value
- **RegExp pattern**: Write a regular expression for format validation
- **Private field**: Tick to prevent it from being found via the API
- **Enable localization for this field**: (if Internationalization is enabled) Allow different values per locale
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Unique field**: Tick to prevent another field from being identical
- **Maximum length**: Define a maximum number of characters allowed
- **Minimum length**: Define a minimum number of characters allowed

**Condition:**
1. Click the **Apply condition** button
2. Define the _if_ part based on a Boolean or Enumeration field (e.g., if `boolean_field` is `true`)
3. Define the _then_ part by choosing whether to hide or show the field

#### Rich Text (Blocks)

The Rich Text (Blocks) field displays an editor with live rendering and various options to manage rich text. This field can be used for long written content, including images and code.

**Basic settings:**
- **Name**: Write the name of the Rich Text (Blocks) field

**Advanced settings:**
- **Private field**: Tick to prevent it from being found via the API
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Enable localization for this field**: Allow different values per locale

**Note**: If using the Blocks editor, it's recommended to also use the Strapi Blocks React Renderer to easily render the content in a React frontend.

#### Number

The Number field displays a field for any kind of number: integer, decimal and float.

**Basic settings:**
- **Name**: Write the name of the Number field
- **Number format**: Choose between _integer_, _big integer_, _decimal_ and _float_

**Advanced settings:**
- **Default value**: Write the default value
- **Private field**: Tick to prevent it from being found via the API
- **Enable localization for this field**: Allow different values per locale
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Unique field**: Tick to prevent another field from being identical
- **Maximum value**: Define a maximum value allowed
- **Minimum value**: Define a minimum value allowed

#### Date

The Date field can display a date (year, month, day), time (hour, minute, second) or datetime picker.

**Basic settings:**
- **Name**: Write the name of the Date field
- **Type**: Choose between _date_, _datetime_ and _time_

**Advanced settings:**
- **Default value**: Write the default value
- **Private field**: Tick to prevent it from being found via the API
- **Enable localization for this field**: Allow different values per locale
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Unique field**: Tick to prevent another field from being identical

#### Password

The Password field displays a password field that is encrypted.

**Basic settings:**
- **Name**: Write the name of the Password field

**Advanced settings:**
- **Default value**: Write the default value
- **Private field**: Tick to prevent it from being found via the API
- **Enable localization for this field**: Allow different values per locale
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Maximum length**: Define a maximum number of characters allowed
- **Minimum length**: Define a minimum number of characters allowed

#### Media

The Media field allows to choose one or more media files from those uploaded in the Media Library.

**Basic settings:**
- **Name**: Write the name of the Media field
- **Type**: Choose between _Multiple media_ and _Single media_

**Advanced settings:**
- **Select allowed types of media**: Click on the drop-down list to untick media types not allowed
- **Private field**: Tick to prevent it from being found via the API
- **Enable localization for this field**: Allow different values per locale
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Unique field**: Tick to prevent another field from being identical

#### Relation

The Relation field allows to establish a relation with another content-type that must be a collection type.

**Relation types:**
- **One way**: Content-type A _has one_ Content-type B
- **One-to-one**: Content-type A _has and belong to one_ Content-type B
- **One-to-many**: Content-type A _belongs to many_ Content-type B
- **Many-to-one**: Content-type B _has many_ Content-type A
- **Many-to-many**: Content-type A _has and belongs to many_ Content-type B
- **Many way**: Content-type A _has many_ Content-type B

**Basic settings:**
1. Click on the 2nd grey box to define the content-type B (must be an already created collection type)
2. Click on the icon representing the relation type
3. Choose the _Field name_ of the content-type A
4. (optional if disabled by the relation type) Choose the _Field name_ of the content-type B

**Advanced settings:**
- **Private field**: Tick to prevent it from being found via the API

#### Boolean

The Boolean field displays a toggle button to manage boolean values (Yes or No, 1 or 0, True or False).

**Basic settings:**
- **Name**: Write the name of the Boolean field

**Advanced settings:**
- **Default value**: Choose the default value: _true_, _null_ or _false_
- **Private field**: Tick to prevent it from being found via the API
- **Enable localization for this field**: Allow different values per locale
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Unique field**: Tick to prevent another field from being identical

#### JSON

The JSON field allows to configure data in a JSON format, to store JSON objects or arrays.

**Basic settings:**
- **Name**: Write the name of the JSON field

**Advanced settings:**
- **Private field**: Tick to prevent it from being found via the API
- **Enable localization for this field**: Allow different values per locale
- **Required field**: Tick to prevent creating or saving an entry if unfilled

#### Email

The Email field displays an email address field with format validation to ensure validity.

**Basic settings:**
- **Name**: Write the name of the Email field

**Advanced settings:**
- **Default value**: Write the default value
- **Private field**: Tick to prevent it from being found via the API
- **Enable localization for this field**: Allow different values per locale
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Unique field**: Tick to prevent another field from being identical
- **Maximum length**: Define a maximum number of characters allowed
- **Minimum length**: Define a minimum number of characters allowed

#### Enumeration

The Enumeration field allows to configure a list of values displayed in a drop-down list.

**Basic settings:**
- **Name**: Write the name of the Enumeration field
- **Values**: Write the values, one per line

**Advanced settings:**
- **Default value**: Choose the default value
- **Name override for GraphQL**: Write a custom GraphQL schema type to override the default one
- **Private field**: Tick to prevent it from being found via the API
- **Enable localization for this field**: Allow different values per locale
- **Required field**: Tick to prevent creating or saving an entry if unfilled

**Caution**: Enumeration values should always have an alphabetical character preceding any number, as it could otherwise cause the server to crash when the GraphQL plugin is installed.

#### UID

The UID field displays a field that sets a unique identifier, optionally based on an existing other field.

**Basic settings:**
- **Name**: Write the name of the UID field (must not contain special characters or spaces)
- **Attached field**: Choose what existing field to attach to the UID field, or choose _None_

**Advanced settings:**
- **Default value**: Write the default value
- **Private field**: Tick to prevent it from being found via the API
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Maximum length**: Define a maximum number of characters allowed
- **Minimum length**: Define a minimum number of characters allowed

**Tip**: The UID field can be used to create a slug based on the Attached field.

#### Rich Text (Markdown)

The Rich Text (Markdown) field displays an editor with basic formatting options to manage rich text written in Markdown. This field can be used for long written content.

**Basic settings:**
- **Name**: Write the name of the Rich Text (Markdown) field

**Advanced settings:**
- **Default value**: Write the default value
- **Private field**: Tick to prevent it from being found via the API
- **Enable localization for this field**: Allow different values per locale
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Maximum length**: Define a maximum number of characters allowed
- **Minimum length**: Define a minimum number of characters allowed

#### Components

Components are a combination of several fields. They allow to create reusable sets of fields that can be quickly added to content-types, dynamic zones, and also nested into other components.

When configuring a component, you can either:
- Create a new component by clicking on _Create a new component_
- Or use an existing one by clicking on _Use an existing component_

**Basic settings:**
- **Name**: Write the name of the component for the content-type
- **Select a component**: When using an existing component only - Select from the drop-down list
- **Type**: Choose between _Repeatable component_ and _Single component_

**Advanced settings:**
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Private field**: Tick to prevent it from being found via the API
- **Maximum value**: For repeatable components only - Define a maximum number allowed
- **Minimum value**: For repeatable components only - Define a minimum number allowed
- **Enable localization for this field**: Allow the component to be translated per available locale

#### Dynamic Zones

Dynamic zones are a combination of components that can be added to content-types. They allow a flexible content structure as administrators can compose and rearrange the components.

**Basic settings:**
- **Name**: Write the name of the dynamic zone for the content-type

**Advanced settings:**
- **Required field**: Tick to prevent creating or saving an entry if unfilled
- **Maximum value**: Define a maximum number allowed
- **Minimum value**: Define a minimum number allowed
- **Enable localization for this field**: Allow the dynamic zone to be translated per available locale

After configuring the settings of the dynamic zone, its components must be configured as well. You can either choose an existing component or create a new one.

**Caution**: When using dynamic zones, different components cannot have the same field name with different types (or with enumeration fields, different values).

#### Custom Fields

Custom fields are a way to extend Strapi's capabilities by adding new types of fields to content-types or components. Once installed, custom fields are listed in the _Custom_ tab when selecting a field for a content-type.

### Deleting Content-types

Content types and components can be deleted through the Content-type Builder. Deleting a content-type automatically deletes all entries from the Content Manager that were based on that content-type.

1. In the Content-type Builder sub navigation, click on the name of the content-type or component to delete.
2. In the edition interface, click on the **Edit** button on the right side.
3. In the edition window, click on the **Delete** button.
4. In the confirmation window, confirm the deletion.
5. Click on the **Save** button in the Content-type Builder sub navigation.

**Caution**: Deleting a content-type only deletes what was created from the Content-type Builder. All the data that was created based on that content-type is however kept in the database.
