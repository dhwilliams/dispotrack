"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AssetTypeFieldDefinition } from "@/lib/supabase/types"
import type { Json } from "@/lib/supabase/types"

interface DynamicFieldsProps {
  fields: AssetTypeFieldDefinition[]
  values: Record<string, Json | undefined>
  onChange: (fieldName: string, value: Json) => void
}

export function DynamicFields({ fields, values, onChange }: DynamicFieldsProps) {
  if (fields.length === 0) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <DynamicField
          key={field.id}
          field={field}
          value={values[field.field_name]}
          onChange={(val) => onChange(field.field_name, val)}
        />
      ))}
    </div>
  )
}

interface DynamicFieldProps {
  field: AssetTypeFieldDefinition
  value: Json | undefined
  onChange: (value: Json) => void
}

function DynamicField({ field, value, onChange }: DynamicFieldProps) {
  switch (field.field_type) {
    case "text":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.field_name}>
            {field.field_label}
            {field.is_required && " *"}
          </Label>
          <Input
            id={field.field_name}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )

    case "number":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.field_name}>
            {field.field_label}
            {field.is_required && " *"}
          </Label>
          <Input
            id={field.field_name}
            type="number"
            value={(value as number) ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
          />
        </div>
      )

    case "boolean":
      return (
        <div className="flex items-center space-x-2 pt-6">
          <Checkbox
            id={field.field_name}
            checked={(value as boolean) ?? false}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          <Label htmlFor={field.field_name} className="font-normal">
            {field.field_label}
          </Label>
        </div>
      )

    case "select": {
      const options = (field.field_options as string[]) ?? []
      return (
        <div className="space-y-2">
          <Label htmlFor={field.field_name}>
            {field.field_label}
            {field.is_required && " *"}
          </Label>
          <Select
            value={(value as string) ?? ""}
            onValueChange={(val) => onChange(val)}
          >
            <SelectTrigger id={field.field_name}>
              <SelectValue placeholder={`Select ${field.field_label.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }

    case "textarea":
      return (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={field.field_name}>
            {field.field_label}
            {field.is_required && " *"}
          </Label>
          <Textarea
            id={field.field_name}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
          />
        </div>
      )

    case "json_array":
      return (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={field.field_name}>
            {field.field_label}
            {field.is_required && " *"}
          </Label>
          <Input
            id={field.field_name}
            placeholder={`Enter ${field.field_label.toLowerCase()}...`}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )

    default:
      return null
  }
}
