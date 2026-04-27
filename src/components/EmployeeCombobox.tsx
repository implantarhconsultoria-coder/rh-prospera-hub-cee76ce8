import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useApp } from '@/hooks/useApp';
import type { Employee } from '@/types/database';

interface EmployeeComboboxProps {
  value?: string; // employee id
  onChange: (employee: Employee | null) => void;
  placeholder?: string;
  companyId?: string;        // restrict to one company
  includeInactive?: boolean; // default false
  className?: string;
  disabled?: boolean;
}

/**
 * Busca digitável de funcionário com autocomplete.
 * Aceita: nome, CPF, matrícula, registro, função.
 * Reutilizável em todas as telas (EPI, Uniformes, Combustível, etc).
 */
const EmployeeCombobox: React.FC<EmployeeComboboxProps> = ({
  value,
  onChange,
  placeholder = 'Buscar funcionário (nome, CPF, matrícula)...',
  companyId,
  includeInactive = false,
  className,
  disabled,
}) => {
  const { employees, companies } = useApp();
  const [open, setOpen] = useState(false);

  const list = useMemo(() => {
    return (employees || [])
      .filter(e => includeInactive || e.status === 'ativo')
      .filter(e => !companyId || e.companyId === companyId);
  }, [employees, companyId, includeInactive]);

  const selected = list.find(e => e.id === value);
  const empresaNome = (cid: string) => companies.find(c => c.id === cid)?.name || '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            {selected ? (
              <span className="truncate">
                <span className="font-medium">{selected.name}</span>
                {selected.cpf && <span className="text-muted-foreground"> · {selected.cpf}</span>}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command
          filter={(value, search) => {
            if (!search) return 1;
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Digite nome, CPF, matrícula ou cargo..." />
          <CommandList>
            <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
            <CommandGroup>
              {list.map(e => {
                const haystack = [e.name, e.cpf, e.matriculaEsocial, e.registro, e.cargo, empresaNome(e.companyId)]
                  .filter(Boolean).join(' | ');
                return (
                  <CommandItem
                    key={e.id}
                    value={haystack}
                    onSelect={() => { onChange(e); setOpen(false); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === e.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{e.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[e.cpf, e.cargo, empresaNome(e.companyId)].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default EmployeeCombobox;
