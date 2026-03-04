import { classNames } from '../lib/helpers'
import './Card.css'

export default function Card({ children, className, padding = true, ...props }) {
  return (
    <div
      className={classNames('card', padding && 'card--padded', className)}
      {...props}
    >
      {children}
    </div>
  )
}
