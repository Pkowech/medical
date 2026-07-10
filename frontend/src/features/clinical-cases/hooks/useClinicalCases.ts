import { useState, useEffect } from 'react';
import {
  ClinicalCase,
  fetchClinicalCases,
} from '@/features/clinical-cases/services/clinicalCaseService';

export const useClinicalCases = () => {
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<ClinicalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedComplexity, setSelectedComplexity] = useState('');

  const specialties = [
    'Internal Medicine',
    'Cardiology',
    'Neurology',
    'Pediatrics',
    'Surgery',
    'Emergency',
    'Psychiatry',
    'Obstetrics',
    'Dermatology',
    'Radiology',
  ];

  const complexities = ['simple', 'moderate', 'complex', 'expert'];

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const casesData = await fetchClinicalCases();
      setCases(casesData);
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [cases, searchTerm, selectedSpecialty, selectedComplexity]);

  const applyFilters = () => {
    let filtered = [...cases];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        case_ =>
          case_.title.toLowerCase().includes(searchLower) ||
          case_.description.toLowerCase().includes(searchLower) ||
          case_.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    if (selectedSpecialty) {
      filtered = filtered.filter(case_ => case_.specialty === selectedSpecialty);
    }

    if (selectedComplexity) {
      filtered = filtered.filter(case_ => case_.complexity === selectedComplexity);
    }

    // Only show published cases
    filtered = filtered.filter(case_ => case_.status === 'published');

    setFilteredCases(filtered);
  };

  return {
    cases,
    filteredCases,
    loading,
    searchTerm,
    setSearchTerm,
    selectedSpecialty,
    setSelectedSpecialty,
    selectedComplexity,
    setSelectedComplexity,
    specialties,
    complexities,
  };
};
