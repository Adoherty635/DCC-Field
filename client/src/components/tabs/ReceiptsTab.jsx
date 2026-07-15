import React from 'react';
import PhotoGrid from '../PhotoGrid.jsx';

export default function ReceiptsTab({ projectId, isAdmin, onCountChange }) {
  return <PhotoGrid projectId={projectId} kind="receipt" canUpload canDelete={isAdmin} onCountChange={onCountChange} />;
}
