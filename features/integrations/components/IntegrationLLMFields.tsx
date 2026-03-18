"use client"

import { FormField } from "@/components/shell/FormField"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  defaultModel: string
  maxConcurrent: number
  supportsToolCalling: boolean
  availableModels: string[]
  isTesting: boolean
  onModelChange: (value: string) => void
  onMaxConcurrentChange: (value: number) => void
  onSupportsToolCallingChange: (value: boolean) => void
}

export function IntegrationLLMFields({
  availableModels,
  defaultModel,
  isTesting,
  maxConcurrent,
  onMaxConcurrentChange,
  onModelChange,
  onSupportsToolCallingChange,
  supportsToolCalling,
}: Props) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <FormField htmlFor="default-model" label="Default model">
          <Select
            disabled={availableModels.length === 0}
            onValueChange={onModelChange}
            value={defaultModel}
          >
            <SelectTrigger id="default-model">
              <SelectValue
                placeholder={isTesting ? "Loading models…" : "Test connection to load models"}
              />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField htmlFor="max-concurrent" label="Max concurrent">
          <Input
            id="max-concurrent"
            min={1}
            onChange={(e) => onMaxConcurrentChange(Number(e.target.value))}
            type="number"
            value={maxConcurrent}
          />
        </FormField>
      </div>

      <label className="flex items-center gap-3 text-sm font-medium text-foreground">
        <Checkbox
          checked={supportsToolCalling}
          onCheckedChange={(checked) => onSupportsToolCallingChange(checked === true)}
        />
        Supports tool calling
      </label>
    </>
  )
}
