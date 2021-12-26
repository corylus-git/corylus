import React, { useEffect } from 'react';
import pixelmatch from 'pixelmatch';
import styled from 'styled-components';
import { useAsync } from 'react-use';
import mime from 'mime-types';

import { useRepo } from '../../../model/state/repo';
import { fromNullable, just, Maybe, nothing } from '../../../util/maybe';
import { Logger } from '../../../util/logger';
import { GitBackend } from '../../../util/GitBackend';

export type ImageDiffProps = {
    oldRef: string;
    newRef: 'index' | string;
    oldPath: string;
    newPath: string;
};

function getPixelData(img: HTMLImageElement): Maybe<ImageData> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx?.drawImage(img, 0, 0);
    if (img.width && img.height) {
        return fromNullable(ctx?.getImageData(0, 0, img.width, img.height));
    }
    return nothing;
}

type LoadedImageData = {
    img: HTMLImageElement;
    url: string;
    size: { w: number; h: number };
};

async function loadImage(
    backend: GitBackend,
    ref: 'workdir' | string,
    path: string
): Promise<Maybe<LoadedImageData>> {
    const fileData = await backend.getFileContents(ref, path);
    if (!fileData.found) {
        return nothing;
    }
    const url = URL.createObjectURL(
        new Blob([fileData.value], { type: mime.lookup(path) || 'text/plain' })
    );
    const img = new Image();
    const prom = new Promise<LoadedImageData['size']>((resolve) => {
        img.onload = (ev) => {
            const i = ev.currentTarget as HTMLImageElement;
            resolve({ w: img.width, h: img.height });
        };
    });
    img.src = url;
    const size = await prom;
    Logger().debug('ImageDiff', 'Loaded image', { url, size });
    return just({
        img,
        url,
        size,
    });
}

const DiffImage = styled.img`
    max-width: 100%;
`;

const DiffNewImageContainer = styled.div`
    position: relative;
    :hover {
        .diff {
            visibility: visible;
            filter: blur(3px);
            animation: pulse 2s infinite;
        }
    }
    .diff {
        top: 0;
        left: 0;
        position: absolute;
        visibility: hidden;
    }
    @keyframes pulse {
        0%   { opacity:0; }
        50%  { opacity:1; }
        100% { opacity:0; }
    }
}
`;

export const ImageDiff: React.FC<ImageDiffProps> = (props) => {
    const backend = useRepo((state) => state.backend);
    const oldImage = useAsync(() => loadImage(backend, props.oldRef, props.oldPath), [
        props.oldRef,
        props.oldPath,
    ]);
    const newImage = useAsync(() => loadImage(backend, props.newRef, props.newPath), [
        props.newRef,
        props.newPath,
    ]);
    const [diffImage, setDiffImage] = React.useState<string>();
    const [differentDimensions, setDifferentDimensions] = React.useState(false);
    // clean up in case the URL changes/the element is unmounted
    useEffect(
        () => () => {
            oldImage.value?.found && URL.revokeObjectURL(oldImage.value.value.url);
        },
        [oldImage]
    );
    useEffect(
        () => () => {
            newImage.value?.found && URL.revokeObjectURL(newImage.value.value.url);
        },
        [newImage]
    );

    useEffect(() => {
        if (oldImage.value?.found && newImage.value?.found) {
            const size = newImage.value.value.size;
            const oldSize = oldImage.value.value.size;
            if (oldSize.w !== size.w || oldSize.h !== size.h) {
                Logger().debug(
                    'ImageDiff',
                    'Cannot calculate diff for images with different dimensions'
                );
                setDifferentDimensions(true);
                setDiffImage(undefined);
                return;
            }
            const mask: Uint8Array = new Uint8Array(size.w * size.h * 4);
            const newPixelData = getPixelData(newImage.value.value.img);
            const oldPixelData = getPixelData(oldImage.value.value.img);
            if (newPixelData.found && oldPixelData.found) {
                const d = pixelmatch(
                    oldPixelData.value.data,
                    newPixelData.value.data,
                    mask,
                    size.w,
                    size.h,
                    {
                        diffMask: true,
                    }
                );
                const c = document.createElement('canvas');
                const ctx = c.getContext('2d');
                const imageData = new ImageData(new Uint8ClampedArray(mask.buffer), size.w, size.h);
                c.width = size.w;
                c.height = size.h;
                ctx?.putImageData(imageData, 0, 0);
                setDifferentDimensions(false);
                setDiffImage(c.toDataURL());
            }
        }
    }, [oldImage, newImage]);

    return diffImage || newImage ? (
        <>
            <DiffNewImageContainer>
                {newImage.value?.found && (
                    <DiffImage className="new" src={newImage.value.value.url} />
                )}
                {diffImage && <DiffImage className="diff" src={diffImage} />}
            </DiffNewImageContainer>
            {differentDimensions && <p>Image was resized.</p>}
        </>
    ) : (
        <div>Loading...</div>
    );
};
