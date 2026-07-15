import React from 'react';
import PhotoGrid from '../PhotoGrid.jsx';

export default function PicturesTab({ projectId, isAdmin, onCountChange }) {
  return <PhotoGrid projectId={projectId} kind="picture" canUpload canDelete={isAdmin} onCountChange={onCountChange} />;
}
