"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface TransactionOption {
  id: string
  transaction_number: string
  client_name: string
}

interface TransactionSelectProps {
  value?: string
  onValueChange: (transactionId: string) => void
  disabled?: boolean
}

export function TransactionSelect({
  value,
  onValueChange,
  disabled,
}: TransactionSelectProps) {
  const [open, setOpen] = useState(false)
  const [transactions, setTransactions] = useState<TransactionOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTransactions() {
      const supabase = createClient()
      const { data } = await supabase
        .from("transactions")
        .select("id, transaction_number, clients(name)")
        .order("transaction_date", { ascending: false })
        .limit(100)

      const options: TransactionOption[] = (data ?? []).map((t) => ({
        id: t.id,
        transaction_number: t.transaction_number,
        client_name:
          (t.clients as unknown as { name: string } | null)?.name ?? "",
      }))
      setTransactions(options)
      setLoading(false)
    }
    fetchTransactions()
  }, [])

  const selected = transactions.find((t) => t.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled || loading}
        >
          {selected
            ? `${selected.transaction_number} — ${selected.client_name}`
            : "Select transaction..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search transactions..." />
          <CommandList>
            <CommandEmpty>No transactions found.</CommandEmpty>
            <CommandGroup>
              {transactions.map((txn) => (
                <CommandItem
                  key={txn.id}
                  value={`${txn.transaction_number} ${txn.client_name}`}
                  onSelect={() => {
                    onValueChange(txn.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === txn.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="font-medium">
                    {txn.transaction_number}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {txn.client_name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
