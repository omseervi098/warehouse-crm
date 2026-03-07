import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface AutocompleteProps {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    onCreate?: (value: string) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
    filterPage?: boolean;
    label?: string;
    error?: string;
}

const Autocomplete: React.FC<AutocompleteProps> = ({
    options,
    value,
    onChange,
    onCreate,
    placeholder,
    className,
    filterPage = false,
    required,
    label,
    error
}) => {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [showCreateOption, setShowCreateOption] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isSelectingOptionRef = useRef(false);

    // Generate unique IDs for accessibility
    const inputId = React.useId();
    const listboxId = React.useId();
    const labelId = React.useId();
    const liveRegionId = React.useId();

    // State for screen reader announcements
    const [announcement, setAnnouncement] = useState('');

    // Filter options based on input value
    const filterOptions = useCallback((inputValue: string) => {
        if (!inputValue.trim()) {
            return options.slice(0, 10); // Show first 10 options when empty
        }

        // Case-insensitive substring filtering
        const filtered = options.filter(option =>
            option.toLowerCase().includes(inputValue.toLowerCase())
        ).slice(0, 10); // Limit to 10 results

        return filtered;
    }, [options]);

    // Update filtered options when value or options change
    useEffect(() => {
        const filtered = filterOptions(value);
        setFilteredOptions(filtered);

        // Show create option if input doesn't exactly match any existing option and onCreate is provided
        const exactMatch = options.some(option =>
            option.toLowerCase() === value.toLowerCase()
        );
        setShowCreateOption(!!onCreate && value.trim() !== '' && !exactMatch);

        // Reset highlighted index when options change
        setHighlightedIndex(-1);

        // Announce filtered results to screen readers
        if (value.trim() && isOpen) {
            const totalResults = filtered.length + (showCreateOption ? 1 : 0);
            if (totalResults === 0) {
                setAnnouncement('No results found');
            } else if (totalResults === 1) {
                setAnnouncement('1 result available');
            } else {
                setAnnouncement(`${totalResults} results available`);
            }
        } else {
            setAnnouncement('');
        }
    }, [value, options, filterOptions, onCreate, isOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;

        // Don't reopen dropdown if we're in the middle of selecting an option
        if (!isSelectingOptionRef.current) {
            onChange(newValue);

            if (!isOpen && newValue.trim()) {
                setIsOpen(true);
            }
        } else {
            // Reset the selecting flag after handling the programmatic change
            isSelectingOptionRef.current = false;
            onChange(newValue);
        }
    };

    const handleInputFocus = () => {
        // Don't reopen dropdown if we're in the middle of selecting an option
        if (!isSelectingOptionRef.current && (filteredOptions.length > 0 || showCreateOption)) {
            setIsOpen(true);
            // Announce that dropdown is open
            setAnnouncement('Autocomplete dropdown opened');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) {
            // Open dropdown on arrow down when closed
            if (e.key === 'ArrowDown' && (filteredOptions.length > 0 || showCreateOption)) {
                e.preventDefault();
                setIsOpen(true);
                setHighlightedIndex(0);
            }
            return;
        }

        const totalOptions = filteredOptions.length + (showCreateOption ? 1 : 0);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => {
                    const newIndex = prev < totalOptions - 1 ? prev + 1 : 0;
                    // Screen readers will announce this via aria-activedescendant
                    return newIndex;
                });
                break;

            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => {
                    const newIndex = prev > 0 ? prev - 1 : totalOptions - 1;
                    // Screen readers will announce this via aria-activedescendant
                    return newIndex;
                });
                break;

            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                    // Select highlighted option
                    const selectedOption = filteredOptions[highlightedIndex];
                    isSelectingOptionRef.current = true;
                    setIsOpen(false);
                    setHighlightedIndex(-1);
                    onChange(selectedOption);
                    setTimeout(() => {
                        isSelectingOptionRef.current = false;
                    }, 0);
                } else if (highlightedIndex === filteredOptions.length && showCreateOption && onCreate) {
                    // Create new item
                    isSelectingOptionRef.current = true;
                    setIsOpen(false);
                    setHighlightedIndex(-1);
                    onCreate(value);
                    setTimeout(() => {
                        isSelectingOptionRef.current = false;
                    }, 0);
                } else if (showCreateOption && onCreate && value.trim()) {
                    // Create new item when no option is highlighted but input has value
                    isSelectingOptionRef.current = true;
                    setIsOpen(false);
                    setHighlightedIndex(-1);
                    onCreate(value);
                    setTimeout(() => {
                        isSelectingOptionRef.current = false;
                    }, 0);
                }
                break;

            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setHighlightedIndex(-1);
                inputRef.current?.focus();
                break;

            case 'Tab':
                setIsOpen(false);
                setHighlightedIndex(-1);
                // Don't prevent default to allow normal tab behavior
                break;
        }
    };

    const handleOptionClick = (option: string) => {
        isSelectingOptionRef.current = true;
        setIsOpen(false);
        setHighlightedIndex(-1);
        onChange(option);
        inputRef.current?.focus();

        // Reset the flag after a short delay to allow focus event to complete
        setTimeout(() => {
            isSelectingOptionRef.current = false;
        }, 0);
    };

    const handleCreateClick = () => {
        if (onCreate && value.trim()) {
            isSelectingOptionRef.current = true;
            setIsOpen(false);
            setHighlightedIndex(-1);
            onCreate(value);
            inputRef.current?.focus();

            // Reset the flag after a short delay to allow focus event to complete
            setTimeout(() => {
                isSelectingOptionRef.current = false;
            }, 0);
        }
    };

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setHighlightedIndex(-1);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Input styling consistent with existing Input component
    const inputClasses = `block w-full rounded-lg border py-2 px-3 ${theme.bg.input} ${theme.text.primary} shadow-sm transition-all duration-200 ${error
        ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
        : `${theme.border.primary} hover:${theme.border.secondary} focus:border-accent focus:ring-2 focus:ring-accent/20`
        } placeholder:${theme.text.muted} text-sm leading-6 ${className} disabled:opacity-60 disabled:cursor-not-allowed`;

    return (
        <div className="relative">
            {label && (
                <label
                    id={labelId}
                    htmlFor={inputId}
                    className={`block text-sm font-medium leading-6 ${theme.text.secondary} ${filterPage ? "mb-0.3" : "mb-1.5"}`}
                >
                    {label}
                </label>
            )}
            <div className={filterPage ? "mt-0 relative" : "mt-2 relative"}>
                <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    required={required}
                    className={inputClasses}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-owns={isOpen ? listboxId : undefined}
                    aria-activedescendant={
                        isOpen && highlightedIndex >= 0
                            ? `${listboxId}-option-${highlightedIndex}`
                            : undefined
                    }
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    aria-labelledby={label ? labelId : undefined}
                />

                {/* Dropdown */}
                {isOpen && (filteredOptions.length > 0 || showCreateOption) && (
                    <div
                        ref={dropdownRef}
                        id={listboxId}
                        role="listbox"
                        aria-label={label ? `${label} options` : "Autocomplete options"}
                        className={`absolute z-[9999] w-full mt-1 ${theme.bg.input} border ${theme.border.primary} rounded-lg shadow-xl max-h-60 overflow-auto
                            /* Mobile responsive improvements */
                            sm:max-h-60 max-h-48
                            /* Enhanced shadow and positioning */
                            drop-shadow-lg backdrop-blur-sm
                            /* Ensure proper layering above other elements */
                            isolate`}
                    >
                        {/* Filtered options */}
                        {filteredOptions.map((option, index) => (
                            <div
                                key={option}
                                id={`${listboxId}-option-${index}`}
                                role="option"
                                aria-selected={index === highlightedIndex}
                                onClick={() => handleOptionClick(option)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                className={`px-3 py-2 cursor-pointer text-sm transition-colors duration-150
                                    /* Mobile touch improvements */
                                    min-h-[44px] flex items-center
                                    ${index === highlightedIndex
                                        ? `${theme.bg.secondary} ${theme.text.primary}`
                                        : `${theme.text.primary} hover:${theme.bg.secondary} active:${theme.bg.secondary}`
                                    } ${index === 0 ? 'rounded-t-lg' : ''} ${index === filteredOptions.length - 1 && !showCreateOption ? 'rounded-b-lg' : ''
                                    }`}
                            >
                                {option}
                            </div>
                        ))}

                        {/* Create new item option */}
                        {showCreateOption && (
                            <div
                                id={`${listboxId}-option-${filteredOptions.length}`}
                                role="option"
                                aria-selected={highlightedIndex === filteredOptions.length}
                                onClick={handleCreateClick}
                                onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
                                className={`px-3 py-2 cursor-pointer text-sm border-t ${theme.border.primary} transition-colors duration-150
                                    /* Mobile touch improvements */
                                    min-h-[44px] flex items-center
                                    ${highlightedIndex === filteredOptions.length
                                        ? `${theme.bg.secondary} ${theme.text.primary}`
                                        : `${theme.text.muted} hover:${theme.bg.secondary} active:${theme.bg.secondary}`
                                    } rounded-b-lg`}
                            >
                                <span className="flex items-center">
                                    <span className="mr-2">+</span>
                                    Create new item: "{value}"
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {error && (
                <p
                    id={`${inputId}-error`}
                    className="mt-2 text-sm text-red-600"
                    role="alert"
                    aria-live="polite"
                >
                    {error}
                </p>
            )}

            {/* Screen reader live region for announcements */}
            <div
                id={liveRegionId}
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            >
                {announcement}
            </div>
        </div>
    );
};

export default Autocomplete;